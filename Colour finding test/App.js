import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import cv from "@techstark/opencv-js";
import Tesseract from 'tesseract.js';  // Import Tesseract.js for OCR
var isImageCaptured = false;



const HomePage = () => {
  const canvasRef = useRef(null);
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [imageCaptured, setImageCaptured] = useState(null);
  const [ocrText, setOcrText] = useState(''); // State to store OCR text
  const [cardNames, setCardNames] = useState([]); // State to store card names

  // Adding frame throttling
  const frameCountRef = useRef(0);

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
        console.log('Loaded card names:', names); // Debugging: log loaded names
        setCardNames(names); // Store names in state
      } catch (error) {
        console.error('Error loading card data:', error);
      }
    };

    fetchCardNames();
  }, []);

  const checkCardNames = (recognizedText, names) => {
    const foundNames = [];
    for (let i = 0; i < names.length; i++) {
      if (recognizedText.toUpperCase().includes(names[i].toUpperCase())) {
        foundNames.push(names[i]);
      }
    }

    if (foundNames.length > 0) {
      console.log('Matched card names:', foundNames);
      alert(`Matched card names: ${foundNames.join(', ')}`); // Alert with matched names
    } else {
      console.log('No card names matched');
    }
  };

  const performOCR = (imageDataURL) => {
    // Use Tesseract.js to recognize text in the captured image
    Tesseract.recognize(
      imageDataURL,
      'eng', // Specify the language; here, 'eng' is for English
      {
        logger: (m) => console.log(m), // Optional logger to see OCR progress
      }
    ).then(({ data: { text } }) => {
      console.log('Detected text:', text);
      setOcrText(text); // Update state with the detected text

      // Use a callback function to access the latest state
      setCardNames((prevCardNames) => {
        checkCardNames(text, prevCardNames); // Pass the latest card names to check
        return prevCardNames;
      });
    }).catch((error) => {
      console.error('Error during OCR:', error);
    });
  };

   const getAverageColorFromImage = (croppedImage) => {
  // Create a new image element
  const img = new Image();
  img.src = croppedImage;

  // Once the image has loaded, analyze the color
  img.onload = () => {
    const offScreenCanvas = document.createElement('canvas');
    offScreenCanvas.width = img.width;
    offScreenCanvas.height = img.height;
    const offScreenContext = offScreenCanvas.getContext('2d');

    // Draw the cropped image onto the canvas
    offScreenContext.drawImage(img, 0, 0, img.width, img.height);

    // Get the image data
    const imageData = offScreenContext.getImageData(0, 0, img.width, img.height);

    // Calculate the average color
    const avgColor = getAverageColor(imageData);
    const cardType = determineCardType(avgColor);
    alert(`Detected Card Type: ${cardType}`);
  };
};

// Function to get the average color in the image data
const getAverageColor = (imageData) => {
  let r = 0, g = 0, b = 0;
  const pixelCount = imageData.width * imageData.height;

  for (let i = 0; i < imageData.data.length; i += 4) {
    r += imageData.data[i];      // Red
    g += imageData.data[i + 1];  // Green
    b += imageData.data[i + 2];  // Blue
  }

  r = Math.floor(r / pixelCount);
  g = Math.floor(g / pixelCount);
  b = Math.floor(b / pixelCount);

  return { r, g, b };
};

// Function to determine card type based on the average color
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
    return "Spell Card";
  } else if (178 < r && r < 217 && 110 < g && g < 164 && 105 < b && b <157) {
    return "Trap Card";

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

    // Perform OCR on the captured image
    performOCR(croppedImage);

    getAverageColorFromImage(croppedImage);
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
      facingMode: "environment", // or "environment" depending on your camera use case
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

            const edges = new cv.Mat();
            cv.Canny(gray, edges, 50, 150);

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
                rect.x >= centralBox.x &&
                rect.y >= centralBox.y &&
                rect.x + rect.width <= centralBox.x + centralBox.width &&
                rect.y + rect.height <= centralBox.y + centralBox.height
              ) {
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

            if (detectedArt && detectedDescription && !imageCaptured) {
              console.log("Art and description detected, capturing image...");
              captureCentralBoxImage(context, rectanglesToDraw[2]);
              isImageCaptured = true;
            }

            src.delete();
            gray.delete();
            edges.delete();
            contours.delete();
            hierarchy.delete();
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
  );
};

export default HomePage;
