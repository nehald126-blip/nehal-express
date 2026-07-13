function formatAddress(addr) {
  const obj = addr.toObject ? addr.toObject() : { ...addr };
  return {
    id: obj._id.toString(),
    label: obj.label || 'Home',
    name: obj.name,
    phone: obj.phone,
    address: obj.address,
    pincode: obj.pincode,
    city: obj.city || '',
    state: obj.state || '',
    isDefault: !!obj.isDefault,
    createdAt: obj.createdAt instanceof Date ? obj.createdAt.toISOString() : obj.createdAt,
    updatedAt: obj.updatedAt instanceof Date ? obj.updatedAt.toISOString() : obj.updatedAt
  };
}

function formatUser(user) {
  const json = user.toJSON();
  json.id = json._id.toString();
  delete json._id;
  delete json.updatedAt;
  delete json.passwordHash;

  if (Array.isArray(json.addresses)) {
    json.addresses = user.addresses.map(formatAddress);
  }

  return json;
}

module.exports = { formatUser, formatAddress };
