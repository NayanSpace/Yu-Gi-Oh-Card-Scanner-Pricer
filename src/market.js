// market.js
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom'; // Import useParams

function Market() {
  const { monsterName } = useParams();
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(false);

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
        const response = await fetch(`http://localhost:4000/scrape?monster=${monsterName}`);
        const data = await response.json();
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
    </div>
  );
}

export default Market;
