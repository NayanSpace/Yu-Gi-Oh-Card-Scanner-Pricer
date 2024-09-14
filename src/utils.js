import Tesseract from 'tesseract.js';
import axios from 'axios';
import { load } from 'cheerio';

export const processImage = async (imageSrc) => {
  const result = await Tesseract.recognize(
    imageSrc,
    'eng',
    {
      logger: (m) => console.log(m),
    }
  );
  return result.data.text;
};

export const fetchPriceData = async (cardName, cardModel) => {
  const searchUrl = `https://www.pricecharting.com/search?q=${encodeURIComponent(cardName + ' ' + cardModel)}`;

  try {
    const { data } = await axios.get(searchUrl);
    const $ = load(data);

    const price = $('.price').first().text();
    return price;
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
};
