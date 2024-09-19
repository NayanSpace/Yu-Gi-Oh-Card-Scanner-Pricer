import React, { useEffect, useRef, useState, useCallback } from 'react';
import {Routes, Route, useNavigate, Navigate } from 'react-router-dom'; // Import necessary components for routing
import cv from "@techstark/opencv-js";
import Tesseract from 'tesseract.js';  // Import Tesseract.js for OCR
import Market from './market';

const HomePage = () => {
  const canvasRef = useRef(null);
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [imageCaptured, setImageCaptured] = useState(null);
  const [ocrText, setOcrText] = useState(''); // State to store OCR text
  var isCardFound = false;
  var detectedCardName = '';
  const blockSizes = [3, 7, 15, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69, 71, 73, 75, 77, 79, 81, 83, 85, 87, 89, 91, 93, 95, 97, 99];
  const allowedWords = useRef(new Set());
  const textDetected = useRef([]);
  const cardNameList = useRef(new Set());
  const navigate = useNavigate();
  var blockSize = 11;
  var isImageCaptured = false;

  const checkAndRedirect = () => {
    if (isCardFound) {
      console.log("Redirecting to: ", detectedCardName);
      navigate(`/market/${detectedCardName}`); // Navigate to the Market page with the card name
    }
  };

  useEffect(() => {
    cv['onRuntimeInitialized'] = () => {
      setIsCvLoaded(true);
      console.log('OpenCV loaded successfully.');
    };

    // Fetch card data from cardinfo.json
    const fetchCardNames = async () => {
      try {
        const response = await fetch('/cardinfo.json'); // Adjust the path if necessary
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json(); // Ensure this returns JSON
        const names = data.data.map((card) => card.name); // Correctly extract names from JSON

        for(let i = 0; i < names.length; i++){
          cardNameList.current.add(names[i]);
          const wordsInName = names[i].split(/(?:,| |-)+/)

          for(let j = 0; j < wordsInName.length; j++){
            allowedWords.current.add(wordsInName[j]);
          }
        }

        console.log('Loaded card names:', cardNameList.current); // Debugging: log loaded names
      } catch (error) {
        console.error('Error loading card data:', error);
      }
    };

    fetchCardNames();
  }, []);

  const checkCardNames = (recognizedText, names) => {
    console.log('Detected text:', recognizedText);
    // const foundNames = [];

    // if (foundNames.length > 0) {
    //   console.log('Matched card names:', foundNames);
    //   // alert(`Matched card names: ${foundNames.join(', ')}`); // Alert with matched names
    // } else {
    //   console.log('No card names matched out');
    // }

    if(blockSize === blockSizes[blockSizes.length-1]){
      var textEst = combineResults(recognizedText);
      console.log("Text Estimation: ", textEst);

      var possibleNames = generatePossibleNames(textEst, names);
      console.log('Possible Names:', possibleNames);

      if(possibleNames.length === 0){
        var textEstBuff = textEst;
        for(let i = 1; i < textEst.length && possibleNames.length === 0; i++){
          textEstBuff = textEst.slice(0, (textEst.length-i));
          console.log("Text Estimation after Next Round: ", textEstBuff);
          possibleNames = generatePossibleNames(textEstBuff, names);
          console.log("Possible Names After Next Round: ", possibleNames);
        } 

        textEst = textEstBuff;
      } 
      if(possibleNames.length === 1){
        console.log("One Possible name left: ", possibleNames.join(', '));
        detectedCardName = possibleNames[0];
        isCardFound = true;
        checkAndRedirect();
        return;
      }
        const possibleNamesBuff = possibleNames;
        const textDetectedBuff = textDetected.current;

        console.log("Remaining possible name strs: ", possibleNamesBuff);
        console.log("Remaining possible text strs: ", textDetectedBuff);

        let minDist = 999999;
        let bestMatch = 99999;

        for(let i = 0; i < possibleNamesBuff.length; i++){
          if(possibleNamesBuff[i] === ""){
            bestMatch = i;
            i = possibleNamesBuff.length;
          } else{
            let dist = 0;

            for (let compareElement of textDetectedBuff) {
              dist += levenshteinDistance(possibleNamesBuff[i], compareElement);
            }

            if(dist < minDist){
              minDist = dist;
              bestMatch = i;

              console.log("Current Leader: ", possibleNames[bestMatch], " Distance: ", minDist)
            }
          }
        }
        console.log("Best Guess for Name: ", possibleNames[bestMatch]);
        detectedCardName = possibleNames[bestMatch];
        isCardFound = true;
        checkAndRedirect();
    }
  };

  const performOCR = (imageDataURL) => {
    return new Promise((resolve, reject) => {
      Tesseract.recognize(
        imageDataURL,
        'eng', // Specify the language; here, 'eng' is for English
        {
          // logger: (m) => console.log(m), // Optional logger to see OCR progress
        }
      )
        .then(({ data: { text } }) => {
          text = normalizeText(text);
          textDetected.current.push(text);
          setOcrText(text); // Update state with the detected text
          resolve(text); // Resolve the promise with the detected text
        })
        .catch((error) => {
          console.error('Error during OCR:', error);
          reject(error); // Reject the promise on error
        });
    });
  };

  const combineResults = (results) => {
    if (results.length === 0) return [];

    // Step 1: Create a frequency map for allowed words
    const wordFrequency = {};

    results.forEach((result) => {
      const words = result.split(/\s+/);

      words.forEach((word) => {
        const normalizedWord = word.toUpperCase(); // Normalize case
        // Step 2: Check if any allowed word is included in the normalized word
        allowedWords.current.forEach((allowedWord) => {
          if (allowedWord.length > 2 && normalizedWord.includes(allowedWord.toUpperCase())) {
            wordFrequency[allowedWord.toUpperCase()] = (wordFrequency[allowedWord.toUpperCase()] || 0) + 1;
          }
        });
      });
    });

    // Step 3: Sort allowed words by frequency
    const sortedWords = Object.entries(wordFrequency).sort((a,b) => b[1] - a[1]).map(([word]) => word);

    return sortedWords;
  };

  const generatePossibleNames = (textWords, cardNames) => {
    const predictedNames = [];

    // Loop through each card name in the set
    for (const cardName of cardNames) {
      let nameValid = true;

      // Check if all words from textWords are included in the current card name
      for (let j = 0; nameValid && j < textWords.length; j++) {
        if (!cardName.toUpperCase().includes(textWords[j])) {
          nameValid = false; // Mark name as invalid if a word is not found
        }
      }

      // If all words are found in the card name, add it to the predicted names
      if (nameValid) {
        predictedNames.push(cardName);
      }
    }

    return predictedNames; // Return the list of possible names
  };

  const enhanceImageForOCR = (src) => {
    const enlarged = new cv.Mat();
    const scaleFactor = 3; // Adjust this factor to control the amount of enlargement (e.g., 2 means 200% enlargement)
    cv.resize(src, enlarged, new cv.Size(0, 0), scaleFactor, scaleFactor, cv.INTER_LINEAR);
    // Convert the image to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(enlarged, gray, cv.COLOR_RGBA2GRAY);

    // Create a kernel for dilation and erosion
    const kernelSize = new cv.Size(7, 7); // Kernel size can be adjusted
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, kernelSize);

    // Apply dilation to increase the size of text regions
    const dilated = new cv.Mat();
    cv.dilate(gray, dilated, kernel, new cv.Point(-1, -1), 1);

    // Apply erosion to remove noise
    const eroded = new cv.Mat();
    cv.erode(dilated, eroded, kernel, new cv.Point(-1, -1), 1);

    // Apply median blur to reduce noise after dilation and erosion
    const blurred = new cv.Mat();
    cv.medianBlur(eroded, blurred, 7); // The kernel size is 3; it should be an odd number

    // Apply adaptive thresholding to create a binary image
    const binary = new cv.Mat();
    cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, 2);

    // Clean up intermediate Mats to free memory
    gray.delete();
    dilated.delete();
    eroded.delete();
    blurred.delete();

    return binary;
  };

  const captureCentralBoxImage = (context, centralBox) => {
    // Get image data within the central box
    const imageData = context.getImageData(centralBox.x, centralBox.y, centralBox.width, centralBox.height);

    // Create a new canvas to store the cropped image
    const offScreenCanvas = document.createElement('canvas');
    offScreenCanvas.width = centralBox.width;
    offScreenCanvas.height = centralBox.height;
    const offScreenContext = offScreenCanvas.getContext('2d');

    // Draw the cropped image onto the offscreen canvas
    offScreenContext.putImageData(imageData, 0, 0);

    // Convert the canvas to an image and set it to state
    const croppedImage = offScreenCanvas.toDataURL('image/png');
    setImageCaptured(croppedImage);

    const avgColor = getAverageColor(imageData);
    const cardType = determineCardType(avgColor);
    console.log(cardType);

    let ocrResults = [];

    const processOCR = (index) => {
      if (index >= blockSizes.length) {
        // After all OCR processing is complete
        // Call checkCardNames here once after processing all OCR
        checkCardNames(textDetected.current, cardNameList.current);

        return; // Exit the function
      }

      blockSize = blockSizes[index];
      // Perform OCR on the enhanced image
      const src = cv.imread(offScreenCanvas);
      const enhancedImage = enhanceImageForOCR(src);
      const enhancedCanvas = document.createElement('canvas');
      cv.imshow(enhancedCanvas, enhancedImage);
      const enhancedImageDataURL = enhancedCanvas.toDataURL('image/png');

      // Set the enhanced image to state to display it
      setImageCaptured(enhancedImageDataURL);

      // Perform OCR
      performOCR(enhancedImageDataURL)
        .then((text) => {
          ocrResults.push(text);
          processOCR(index + 1); // Process the next block size
        })
        .catch((error) => {
          console.error('Error during OCR:', error);
          processOCR(index + 1); // Continue to the next block size even if OCR fails
        });

      // Clean up
      src.delete();
      enhancedImage.delete();
    };

    processOCR(0); // Start the OCR processing with the first block size
  };

  const normalizeText = (text) => {
    return text.toUpperCase().replace(/[^A-Z0-9\s]/g, "").trim();
  };

  const levenshteinDistance = (str1, str2) => {
    const len1 = str1.length;
    const len2 = str2.length;

    const distanceMatrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) distanceMatrix[i][0] = i;
    for (let j = 0; j <= len2; j++) distanceMatrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          distanceMatrix[i][j] = distanceMatrix[i - 1][j - 1];
        } else {
          distanceMatrix[i][j] = Math.min(
            distanceMatrix[i - 1][j] + 1,
            distanceMatrix[i][j - 1] + 1,
            distanceMatrix[i - 1][j - 1] + 1
          );
        }
      }
    }

    return distanceMatrix[len1][len2];
  };

  // Function to get the average color in the image data
  const getAverageColor = (imageData) => {
    let r = 0, g = 0, b = 0;
    let count = 0; // Counter for non-white pixels

    for (let i = 0; i < imageData.data.length; i += 4) {
        const red = imageData.data[i];      // Red
        const green = imageData.data[i + 1];  // Green
        const blue = imageData.data[i + 2];  // Blue

        // Check if the pixel is not white (you can adjust the threshold if needed)
        if (!(red > 150 && green > 150 && blue > 150) && !(red < 100 && green < 100 && blue < 100)) {
            r += red;
            g += green;
            b += blue;
            count++;
        }
    }

    // Avoid division by zero if no non-white pixels are found
    if (count === 0) {
        return { r: 0, g: 0, b: 0 }; // Or return a different default color
    }

    // Calculate average color
    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);

    return { r, g, b };
  };

  const determineCardType = (avgColor) => {
    const { r, g, b } = avgColor;
    /* This is not perfect and can be 100% more optimized, but more less gets the job done.
       The value where got just from scanning a few card and get there colour and based on
       that we made range of test cases. It not always going to be accurate but this is
       more as a help function so it doesn't always have to look through 11,000 or so cards everytime
       it scans a card. It can be made much more accurate if you use like 100 cards to test there
       colours and then make a test case for that, but where lazy lol.
    */

    //Stable Green
    if (165 < r && r < 200 && 135 < g && g < 175 && 65 < b && b < 115) {
      return `Monster (R: ${r}, G: ${g}, B: ${b})`;

    } else if (70 < r && r < 121 && 154 < g && g < 196 && 114 < b && b < 174) {
      return `Spell Card (R: ${r}, G: ${g}, B: ${b})`;
    } else if (130< r && r < 217 && 110 < g && g < 164 && 105 < b && b <250) {
      return `Trap (R: ${r}, G: ${g}, B: ${b})`;

      // Stable Blue
    } else if (145 < r && r < 195 && 135 < g && g < 195 && 50 < b && b < 95) {
      return `Normal Monster (R: ${r}, G: ${g}, B: ${b})`;

      //Stable Blue & Green
    } else if (80 < r && r < 130 && 125 < g && g < 165 && 145 < b && b < 165 ) {
      return `Ritual Monster (R: ${r}, G: ${g}, B: ${b})`;

      // For link monster it not that stable cause our scanner has trouble scanning link card.
    } else if(65 < r && r < 120 && 110 < g && g < 155 && 135 < b && b < 185) {
      return `Link Monster (R: ${r}, G: ${g}, B: ${b})`;

      // Same for this pretty bad
    } else if (110 < r && r < 160 && 115 < g && g < 150 && 125 < b && 185) {
      return `Fusion Monster (R: ${r}, G: ${g}, B: ${b})`;

      // Stable Green&Blue
    } else if (155 < r && r < 190 && 170 < g && g < 200 && 130 < b && b < 150) {
      return `Synchro Monster (R: ${r}, G: ${g}, B: ${b})`;

    } else {
      return `Unknown Type (R: ${r}, G: ${g}, B: ${b})`;
    }
  };

 const processFrame = useCallback(() => {
  if (canvasRef.current && isCvLoaded) {
    const video = document.createElement('video');
    // video.width = 640;
    // video.height = 480;
    video.autoplay = true;

    const videoConstraints = {
      width: { ideal: 640 }, // Or use a resolution like 480
      height: { ideal: 480 }, // Adjust based on your needs
      facingMode: "environment", // user or "environment" depending on your camera use case
    };

    navigator.mediaDevices.getUserMedia({ video: videoConstraints }).then((stream) => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        const context = canvasRef.current.getContext('2d');
        video.play();

        const drawFrame = () => {
          if (context && video.readyState === 4 && !imageCaptured) { // Stop processing if image is captured
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            context.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);

            const canvasWidth = canvasRef.current.width;
            const canvasHeight = canvasRef.current.height;
            const centralBoxWidth = canvasWidth * 0.50;
            const centralBoxHeight = canvasHeight * 0.975;
            const centralBoxArea = centralBoxWidth * centralBoxHeight;
            const centralBox = {
              x: (canvasWidth - centralBoxWidth) / 2,
              y: (canvasHeight - centralBoxHeight) / 2,
              width: centralBoxWidth,
              height: centralBoxHeight,
              area: centralBoxArea,
            };

            context.strokeStyle = 'red';
            context.lineWidth = 5;
            context.strokeRect(centralBox.x, centralBox.y, centralBox.width, centralBox.height);

            const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
            const src = cv.matFromImageData(imageData);
            const gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            const blurred = new cv.Mat();
            cv.GaussianBlur(gray, blurred, new cv.Size(9, 9), 0);

//            const equalizedGray = new cv.Mat();
//            cv.equalizeHist(blurred, equalizedGray);

            const adaptiveThreshold = new cv.Mat();
            cv.adaptiveThreshold(blurred, adaptiveThreshold, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

            const edges = new cv.Mat();
            cv.Canny(adaptiveThreshold, edges, 10, 40);

//            const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
//            cv.dilate(edges, edges, kernel);

            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            let detectedArt = false;
            let detectedDescription = false;
            let detectedName = false;
            const rectanglesToDraw = [];

            for (let i = 0; i < contours.size(); i++) {
              const contour = contours.get(i);
              const rect = cv.boundingRect(contour);
              const aspectRatio = rect.width / rect.height;
              const area = rect.width * rect.height;

              if (
                rect.x > centralBox.x &&
                rect.y > centralBox.y &&
                rect.x + rect.width < centralBox.x + centralBox.width &&
                rect.y + rect.height < centralBox.y + centralBox.height
              ) {

                if (aspectRatio > 0.8 && aspectRatio < 1.2 && area > (centralBox.area * 0.375) && area < (centralBox.area * 0.5) && !detectedArt && (rect.y > (centralBox.y + 20 + 50))) {
                    cv.rectangle(
                    src,
                    new cv.Point(rect.x, rect.y),
                    new cv.Point(rect.x + rect.width, rect.y + rect.height),
                    [0, 255, 0, 255], // Green color for all rectangles
                    2
                    );
                }
                if (aspectRatio > 0.8 && aspectRatio < 1.2 && area > (centralBox.area * 0.375) && area < (centralBox.area * 0.5) && !detectedArt && (rect.y > (centralBox.y + 20 + 50))) {
                  if(detectedDescription){
                    if(rect.y + rect.height < rectanglesToDraw[0].y){
                      detectedArt = true;
                      rectanglesToDraw.push(rect);
                    }
                  } else{
                    detectedArt = true;
                    rectanglesToDraw.push(rect);
                  }
                } else if (aspectRatio > 2.5 && aspectRatio < 3.2 && area > (centralBox.area * 0.15) && area < (centralBox.area * 0.21) && !detectedDescription) {
                  if(detectedArt){
                    if(rect.y > rectanglesToDraw[0].y + rectanglesToDraw[0].height){
                      detectedDescription = true;
                      rectanglesToDraw.push(rect);
                    }
                  } else{
                    detectedDescription = true;
                    rectanglesToDraw.push(rect);
                  }
                }
                if(detectedDescription && detectedArt && (rect.y + rect.height < rectanglesToDraw[0].y) && (rect.y + rect.height < rectanglesToDraw[1].y) && aspectRatio > 6.5 && aspectRatio < 8.5 && area > (centralBox.area * 0.02) && area < (centralBox.area * 0.19)){
                  rectanglesToDraw.push(rect);
                  detectedName = true;
                  console.log(area);
                }
              }
              contour.delete();
            }

            if (!detectedName && detectedArt && detectedDescription) {
              // Draw a default rectangle if no name is detected
              const defaultRect = {
                x: centralBox.x + 20,
                y: centralBox.y + 20,
                width: centralBoxWidth - 40, // Example width
                height: 50  // Example height
              };
              rectanglesToDraw.push(defaultRect);
              cv.rectangle(
                src,
                new cv.Point(defaultRect.x, defaultRect.y),
                new cv.Point(defaultRect.x + defaultRect.width, defaultRect.y + defaultRect.height),
                [255, 0, 0, 255], // Color blue for the default rectangle
                2
              );
              console.log("Default rectangle drawn.");
            } 

            if (detectedArt && detectedDescription) {
              rectanglesToDraw.forEach((rect) => {
                cv.rectangle(
                  src,
                  new cv.Point(rect.x, rect.y),
                  new cv.Point(rect.x + rect.width, rect.y + rect.height),
                  [0, 255, 0, 255],
                  2
                );
              });
            }

            cv.imshow(canvasRef.current, src);

            if (detectedArt && detectedDescription && !isImageCaptured) {
              console.log("Art and description detected, capturing image...");
              captureCentralBoxImage(context, rectanglesToDraw[2]);
              isImageCaptured = true;
            }

            src.delete();
            gray.delete();
            edges.delete();
            contours.delete();
            hierarchy.delete();
            blurred.delete();
            adaptiveThreshold.delete();
//            equalizedGray.delete();
//            kernel.delete();
          }

          if (!isImageCaptured) { // Continue processing only if image is not captured
            requestAnimationFrame(drawFrame);
          }
        };

        drawFrame();
      };
    });
  }
}, [isCvLoaded, imageCaptured]);

  useEffect(() => {
    if (canvasRef.current && isCvLoaded) {
      requestAnimationFrame(processFrame);
    }
  }, [isCvLoaded, processFrame]);

return (
    <Routes>
      {/* Redirect from root to /Homepage */}
      <Route path="/" element={<Navigate to="/Homepage" />} />
      {/* Render the HomePage component */}
      <Route path="/Homepage" element={
        <div className="container mx-auto p-4">
          <h1 className="text-center text-3xl font-bold mb-4">Webcam Card Detection</h1>
          <div className="flex flex-col items-center">
            <canvas ref={canvasRef} width="640" height="480" className="border-2 border-gray-300" />
            {imageCaptured && (
              <div className="mt-4">
                <h2 className="text-lg font-semibold">Captured Image</h2>
                <img src={imageCaptured} alt="Captured Image" className="mt-2" />
                {ocrText && (
                  <div className="mt-2">
                    <h3 className="text-md font-semibold">Detected Text:</h3>
                    <p>{ocrText}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      } />
      {/* Render the Market component */}
      <Route path="/market/:monsterName" element={<Market />} />
    </Routes>
  );
};
export default HomePage;
