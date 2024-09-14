import React, { useState } from 'react';

function App() {
  const [monsterName, setMonsterName] = useState('');
  const [cardData, setCardData] = useState(null);
  const [loading, setLoading] = useState(false);  // Loading state

  // List of background image URLs
  const backgroundImages = [
    '/images/image1.png',
    '/images/image2.png',
    '/images/image3.png',
  ];

  const handleScrape = async () => {
    setLoading(true); // Start loading
    try {
      const response = await fetch(`/scrape?monster=${monsterName}`);
      const data = await response.json();
      setCardData(data);
    } catch (error) {
      console.error('Error fetching the card data:', error);
    }
    setLoading(false); // Stop loading
  };

  // Function to randomly select a background
  const getRandomBackground = () => {
    return backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
  };

  return (
    <div className="App">
      <h1>Card Price Scraper</h1>
      <input
        type="text"
        placeholder="Enter Monster Name"
        value={monsterName}
        onChange={(e) => setMonsterName(e.target.value)}
      />
      <button onClick={handleScrape}>Get Card Prices</button>

      {loading && <p>Loading...</p>}  {/* Show loading */}

      <div className="card-container">
        {cardData && cardData.map((version, index) => (
          <div
            className="card"
            key={index}
            style={{
              backgroundImage: `url(${getRandomBackground()})`, // Apply random background
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: 'white', // Adjust text color for better visibility
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
    </div>
  );
}

export default App;
