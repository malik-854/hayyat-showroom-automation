export const fetchProducts = async () => {
  try {
    // In development (local), we call the local server. In production, we call the Vercel API.
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching live products:', error);
    // Fallback to empty array if the API fails
    return [];
  }
};