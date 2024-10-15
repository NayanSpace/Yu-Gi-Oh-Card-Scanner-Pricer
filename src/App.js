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
  const blockSizes = [15, 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73];
  const allowedWords = useRef(new Set());
  const textDetected = useRef([]);
  const textDetectedCopy = useRef(textDetected.current);
  const cardNameList = useRef(new Set());
  const navigate = useNavigate();
  var blockSize = 11;
  var isImageCaptured = false;
  const [isFullscreen, setIsFullscreen] = useState(false);


  const checkAndRedirect = () => {
    if (isCardFound) {
      console.log("Redirecting to: ", detectedCardName);
      navigate(`/market/${detectedCardName}`); // Navigate to the Market page with the card name
    }
  };

  const resetState = () => {
      setImageCaptured(null);
      setOcrText('');
      isCardFound = false;
      detectedCardName = '';
      textDetected.current = [];
      textDetectedCopy.current = [];

      stopCamera();

      startCamera();
    };

  useEffect(() => {
    resetState();

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
  }, [navigate, isCvLoaded]);

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
        const textDetectedBuff = textDetectedCopy.current;

        console.log("Remaining possible name strs: ", possibleNamesBuff);
        console.log("Remaining possible text strs: ", textDetectedBuff);

        let estimatedNames = [];
        let minDist = 999999;
        let bestMatch = 99999;


        // Loop through textDetectedBuff first, then through possibleNamesBuff
        for (let compareElement of textDetectedBuff) {
            for (let i = 0; i < possibleNamesBuff.length; i++) {
                if (possibleNamesBuff[i] === "") {
                    bestMatch = i;
                    break;
                } else {
                    let dist = levenshteinDistance(possibleNamesBuff[i], compareElement);
                    if (dist < minDist) {
                        minDist = dist;
                        bestMatch = i;
                        console.log("Current Leader: ", possibleNames[bestMatch], " Distance: ", minDist);
                    }
                }
            }
            estimatedNames.push(possibleNames[bestMatch]);
        }

        console.log("Best Estimate for each text detected: ", estimatedNames);
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
          const splitText = text.split("\n");
          textDetected.current = textDetected.current.concat(splitText);
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
        // Optional: Remove punctuation for more accurate matching
        // const cleanedWord = normalizedWord.replace(/[^\w\s]/gi, '');

        allowedWords.current.forEach((allowedWord) => {
          const normalizedAllowedWord = allowedWord.toUpperCase();
          if (
            allowedWord.length > 2 &&
            normalizedWord.includes(normalizedAllowedWord)
          ) {
            wordFrequency[normalizedAllowedWord] =
              (wordFrequency[normalizedAllowedWord] || 0) + 1;
          }
        });
      });
    });

    // Step 3: Sort allowed words by frequency and then by length
    const sortedWords = Object.entries(wordFrequency)
      .sort((a, b) => {
        // First, sort by frequency in descending order
        if (b[1] !== a[1]) {
          return b[1] - a[1];
        }
        // If frequencies are equal, sort by word length in descending order
        return b[0].length - a[0].length;
      })
      .map(([word]) => word);

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

    const imageOffScreen = cv.imread(offScreenCanvas)
    const avgHSV = getAverageHSVColor(imageOffScreen);
    const cardType = determineCardTypeFromHSV(avgHSV);
    console.log(cardType);

    let ocrResults = [];

    const processOCR = (index) => {
      if (index >= blockSizes.length) {
        // After all OCR processing is complete
        // Call checkCardNames here once after processing all OCR
        removeShortElements();
        textDetectedCopy.current = textDetected.current;
        textDetected.current = autocorrect(textDetected.current);
        console.log("Autocorrect: ", textDetected.current);
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

// Function to find the closest matching words in allowedWords
function findClosestMatch(word) {
    let allowedWordsArray = Array.from(allowedWords.current);
    let closestWords = [];  // Array to store words with the minimum distance
    let minDistance = Math.max(1, Math.floor(word.length / 2));

    if (word.length > 2) {
        allowedWordsArray.forEach((allowedWord) => {
            const distance = levenshteinDistance(word.toUpperCase(), allowedWord.toUpperCase());

            if (distance < minDistance) {
                // New minimum distance found, reset the array
                minDistance = distance;
                closestWords = [allowedWord.toUpperCase()];
            } else if (distance === minDistance) {
                // Add the word to the array if it has the same minDistance
                closestWords.push(allowedWord.toUpperCase());
            }
        });
    }
    if(closestWords.length > 3){
      return word;
    }
    // Join all closest words into a single string, separated by a space (or any other delimiter)
    return closestWords.length > 0 ? closestWords.join(', ') : word;
}

  // Modified autocorrect function to handle an array of input strings
  function autocorrect(inputStrings) {
      return inputStrings.map(inputString => {
          const words = inputString.split(/\s+/);
          const correctedWords = words.map((word) => findClosestMatch(word));
          return correctedWords.join(' ');
      });
  }

  const removeShortElements = () => {
    // Calculate the average length of all text elements in textDetected
    const totalLength = textDetected.current.reduce((sum, text) => sum + text.length, 0);
    const averageLength = totalLength / textDetected.current.length;

    // Define a threshold for "significantly shorter" (e.g., less than 50% of average length)
    const threshold = averageLength * 0.5;

    // Filter out elements shorter than the threshold
    textDetected.current = textDetected.current.filter(text => text.length >= threshold);

    console.log("Filter 1: ", textDetected.current);
  };

  // Modify the filterByLevenshtein function to iterate and increment the threshold if necessary
  const filterByLevenshteinWithDynamicThreshold = () => {
    let threshold = 10;  // Start with a threshold of 10
    const maxThreshold = 50;  // Set a reasonable upper limit to avoid infinite loop
    let filteredArr = [];

    const arr = textDetected.current;  // Reference the current value of textDetected

    // Iteratively increase the threshold until filteredArr is not empty or max threshold is reached
    while (filteredArr.length === 0 && threshold <= maxThreshold) {
      filteredArr = [];

      // Calculate distances and filter by the current threshold
      for (let i = 0; i < arr.length; i++) {
        let totalDistance = 0;

        for (let j = 0; j < arr.length; j++) {
          if (i !== j) {
            totalDistance += levenshteinDistance(arr[i], arr[j]);
          }
        }

        const avgDistance = totalDistance / (arr.length - 1);

        if (avgDistance < threshold) {
          filteredArr.push(arr[i]);
        }
      }

      // If filteredArr is empty, increase the threshold and try again
      if (filteredArr.length === 0) {
        threshold += 5;  // Increment the threshold by 5
        console.log(`Threshold increased to: ${threshold}`);
      }
    }

    // Modify textDetected.current in place with the filtered result
    textDetected.current = filteredArr;
    console.log("Filtered textDetected.current:", textDetected.current);
  };

const getAverageHSVColor = (imageOffScreen) => {
    const hsvImage = new cv.Mat();
    // Convert the image to HSV
    cv.cvtColor(imageOffScreen, hsvImage, cv.COLOR_RGB2HSV);

    // Create an object to store frequencies of HSV values (we'll use hue for frequency)
    const hueFrequency = {};
    let totalS = 0, totalV = 0;
    let count = 0;

    for (let i = 0; i < hsvImage.rows; i++) {
        for (let j = 0; j < hsvImage.cols; j++) {
            const hsvPixel = hsvImage.ucharPtr(i, j);
            const h = hsvPixel[0];  // Hue value
            const s = hsvPixel[1];  // Saturation value
            const v = hsvPixel[2];  // Value (brightness)

            // Increase the hue frequency count
            hueFrequency[h] = (hueFrequency[h] || 0) + 1;

            // Track the total saturation and value for average calculation
            totalS += s;
            totalV += v;
            count++;
        }
    }

    // Find the most common hue value
    let mostCommonHue = 0;
    let maxCount = 0;
    for (const h in hueFrequency) {
        if (hueFrequency[h] > maxCount) {
            maxCount = hueFrequency[h];
            mostCommonHue = h;
        }
    }

    // Calculate average saturation and value
    const averageS = ((totalS / count) / 255) * 100;
    const averageV = ((totalV / count) / 255) * 100;

    // Clean up the OpenCV matrix
    hsvImage.delete();

    return { h: mostCommonHue, s: averageS, v: averageV };
  };

  const determineCardTypeFromHSV = (avgHSV) => {
    const { h, s, v } = avgHSV;

    if (h >= 40 && h <= 10 ) {
        return `Monster (H: ${h}, S: ${s}, V: ${v})`;
    } else if (h >= 100 && h <= 70) {
        return `Spell (H: ${h}, S: ${s}, V: ${v})`;
    } else if (h >= 130 && h <= 160) {
        return `Trap (H: ${h}, S: ${s}, V: ${v})`;
    } else {
        return `Unknown Type (H: ${h}, S: ${s}, V: ${v})`;
    }
  };

    // Function to toggle fullscreen mode
  const toggleFullscreen = () => {
    const canvas = canvasRef.current;

    if (!isFullscreen) {
      // Request fullscreen
      if (canvas.requestFullscreen) {
        canvas.requestFullscreen();
      } else if (canvas.mozRequestFullScreen) {
        canvas.mozRequestFullScreen(); // Firefox
      } else if (canvas.webkitRequestFullscreen) {
        canvas.webkitRequestFullscreen(); // Chrome, Safari and Opera
      } else if (canvas.msRequestFullscreen) {
        canvas.msRequestFullscreen(); // IE/Edge
      }

      startCamera();

      setIsFullscreen(true);
    } else {
      // Exit fullscreen
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen(); // Firefox
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen(); // Chrome, Safari and Opera
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen(); // IE/Edge
        }
      }

      stopCamera();

      setIsFullscreen(false);
    }
  };

 const startCamera = useCallback(() => {
  if (canvasRef.current && isCvLoaded) {
    const video = document.createElement('video');
    // video.width = 640;
    // video.height = 480;
    video.autoplay = true;

    const videoConstraints = {
      // width: { ideal: 640 }, // Or use a resolution like 480
      // height: { ideal: 480 }, // Adjust based on your needs
      facingMode: "user", // or "environment" depending on your camera use case
    };

    navigator.mediaDevices.getUserMedia({ video: videoConstraints }).then((stream) => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        const context = canvasRef.current.getContext('2d');
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;

        video.play();

        const drawFrame = () => {
          if (context && video.readyState === 4 && !imageCaptured) { // Stop processing if image is captured
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            context.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);

            const videoAspectRatio = video.videoWidth / video.videoHeight;

            const centralBoxAspectRatio = 2 / 3;

            const canvasWidth = canvasRef.current.width;
            const canvasHeight = canvasRef.current.height;

            const centralBoxHeight = canvasHeight * 0.975;
            const centralBoxWidth = centralBoxHeight * centralBoxAspectRatio;
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
            cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

            const adaptiveThreshold = new cv.Mat();
            cv.adaptiveThreshold(blurred, adaptiveThreshold, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

            const edges = new cv.Mat();
            cv.Canny(adaptiveThreshold, edges, 10, 255);

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

                if(aspectRatio > 0.8 && aspectRatio < 1.2 && area > (centralBox.area * 0.375) && area < (centralBox.area * 0.5)){
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
                } else if (aspectRatio > 2.5 && aspectRatio < 3.5 && area > (centralBox.area * 0.15) && area < (centralBox.area * 0.21) && !detectedDescription) {
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
                if(detectedDescription && detectedArt && (rect.y + rect.height < rectanglesToDraw[0].y) && (rect.y + rect.height < rectanglesToDraw[1].y) && aspectRatio > 6.5 && aspectRatio < 8.5 && area > (centralBox.area * 0.05) && area < (centralBox.area * 0.19)){
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

const stopCamera = () => {
  const video = document.querySelector('video');
  if (video && video.srcObject) {
    let stream = video.srcObject;
    let tracks = stream.getTracks();

    tracks.forEach((track) => track.stop()); // Stop all tracks (i.e., stop the camera)
    video.srcObject = null; // Remove the video

  }
};

  return (
    <Routes>
      {/* Redirect from root to /Homepage */}
      <Route path="/" element={<Navigate to="/Homepage" />} />

      {/* Render the HomePage component */}
      <Route path="/Homepage" element={
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-12 col-md-8 text-center my-3">
              <h1 className="display-4">Webcam Card Detection</h1>

              {/* Button to toggle fullscreen */}
              <button className="btn btn-primary mb-3" onClick={toggleFullscreen}>
                {isFullscreen ? "Exit Fullscreen" : "Go Fullscreen"}
              </button>

              <canvas
                ref={canvasRef}
                width="640"
                height="480"
                className="border border-secondary my-3"
                style={{
                  width: isFullscreen ? "100vw" : "640px", // Width takes whole screen if fullscreen
                  height: isFullscreen ? "100vh" : "480px", // Height takes whole screen if fullscreen
                  display: "block", // Ensure the canvas is centered
                  margin: "0 auto", // Center the canvas horizontally
                }}
              />
            </div>
          </div>
        </div>
      } />

      {/* Render the Market component */}
      <Route path="/market/:monsterName" element={<Market />} />
    </Routes>
  );
}

export default HomePage;
