function currency(n) {
  return Math.round(n * 100) / 100;
}

function publicProduct(p) {
  return p;
}

module.exports = { currency, publicProduct };
