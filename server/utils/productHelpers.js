function buildProductQuery({ category, search, minPrice, maxPrice }) {
  const query = {};

  if (category && category !== 'all') {
    query.category = category;
  }
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }
  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [{ name: regex }, { description: regex }, { category: regex }];
  }

  return query;
}

function getProductSort(sort) {
  if (sort === 'price-asc') return { price: 1 };
  if (sort === 'price-desc') return { price: -1 };
  if (sort === 'rating') return { rating: -1 };
  return null;
}

function applyNewSort(products) {
  const taggedNew = products.filter((p) => p.tags.includes('new'));
  const rest = products.filter((p) => !p.tags.includes('new'));
  return taggedNew.concat(rest);
}

module.exports = { buildProductQuery, getProductSort, applyNewSort };
