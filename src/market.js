import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useNavigate

function Market() {
  const { monsterName } = useParams();
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // Initialize navigate

  // List of background image URLs
  const backgroundImages = [
    '/images/image2.png',
    '/images/image1.png',
    '/images/image3.png',
  ];

  // Fetch card data when the component is loaded
  useEffect(() => {
    const handleScrape = async () => {
      if (!monsterName) return;
      setLoading(true);
      try {
        const response = await fetch(`https://045c-99-213-72-58.ngrok-free.app/scrape?monster=${monsterName}`);
        const data = await response.json();
        console.log('Fetched card data:', data);
        setCardData(data);
      } catch (error) {
        console.log(monsterName);
        console.error('Error fetching the card data:', error);
      }
      setLoading(false);
    };

    handleScrape();
  }, [monsterName]);

  const getRandomBackground = () => {
    return backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
  };

  // Add a function to navigate back to the home page
  const handleScanAgain = () => {
    navigate("/Homepage"); // This will take you back to the home page
  };

  return (
    <div className="App">
      <h1>Card Price Scraper</h1>
      <h2> {monsterName} </h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="card-container">
          {cardData && cardData.map((version, index) => (
            <div
              className="card"
              key={index}
              style={{
                backgroundImage: `url(${getRandomBackground()})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'white',
                padding: '1rem',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                margin: '1rem'
              }}
            >
              <h3>{version.versionName}</h3>
              <p>Lowest Price: {version.lowestPrice}</p>
              <p>Highest Price: {version.highestPrice}</p>
              <p>Average Price: {version.averagePrice}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add the Scan Again button */}
      <button onClick={handleScanAgain} style={{
        marginTop: '20px',
        padding: '10px 20px',
        fontSize: '16px',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
      }}>
        Scan Again
      </button>
    </div>
  );
}

export default Market;
