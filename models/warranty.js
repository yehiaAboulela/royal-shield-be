const mongoose = require("mongoose");
const schema = mongoose.Schema;

const warrantySchema = new schema({
  name: String,
  phoneNumber: String,
  birthdate: String,
  address: String,
  brand: String,
  model: String,
  color: String,
  email: String,
  serialNumber: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
const Waranty = mongoose.model("Waranty", warrantySchema);
module.exports = Waranty;
