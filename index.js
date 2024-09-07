const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();
// const { sendFile } = require("express/lib/response");

const app = express();

app.use(express.json());
app.use(cors());
const upload = multer({ dest: "uploads/" });

const Warranty = require("./models/warranty");
const Serial = require("./models/serial");
const Offer = require("./models/offer");
const Admin = require("./models/admin");

mongoose
  .connect(`${process.env.MONGO_URI}`)
  .then(() => {
    console.log("db connected succefully");
  })
  .catch(() => {
    console.log("err connecting DB");
  });
/* admin add or delete serials */
app.post("/addSerial", async (req, res) => {
  const { serialNumber } = req.body;

  try {
    const existingSerial = await Serial.findOne({ serialNumber });
    if (existingSerial) {
      return res.status(400).send({ msg: "Serial already exists" });
    } else {
      const newSerial = new Serial({
        serialNumber,
      });
      await newSerial.save();
      const serials = await Serial.find({});
      res.status(201).send({ msg: "success", serials: serials });
    }
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

app.post("/deleteSerial", async (req, res) => {
  console.log(req.body);
  const { serialNumber } = req.body;
  try {
    const deletedSerial = await Serial.findOneAndDelete({ serialNumber });
    console.log(deletedSerial);
    if (!deletedSerial) {
      return res.status(404).send("Serial not found");
    }
    const serial = await Serial.find({});
    res.status(200).send({ msg: "success", serial: serial });
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

app.get("/viewSerials", async (req, res) => {
  try {
    // Retrieve all serials from the database
    const serials = await Serial.find({});

    // Check if any serials exist
    if (serials.length === 0) {
      return res.status(404).send("No serials found");
    }

    // Send the list of serials back as a response
    res.status(200).json({ status: "ok", serials });
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});
/* user check serials */
app.post("/checkSerial", async (req, res) => {
  try {
    const { serialNumber } = req.body;
    const serialNum = await Serial.findOne({ serialNumber });
    // console.log(serialNum);
    if (serialNum.activated) {
      const curSerial = serialNum.serialNumber;
      const { name, phoneNumber } = await Warranty.findOne({
        serialNumber: curSerial,
      });
      const hiddenName = name.slice(-3);
      const hiddenPhone = phoneNumber.slice(-3);
      return res.send({
        status: "act",
        owner: { name: hiddenName, phone: hiddenPhone },
      });
    }
    if (serialNum && serialNum.numOfChecks > 0) {
      serialNum.numOfChecks -= 1;
      await serialNum.save();

      // Generate JWT token
      const token = jwt.sign(
        { serialNumber: serialNum.serialNumber },
        process.env.JWT_SECRET_KEY, // Replace with your actual secret key
        { expiresIn: "24h" } // Token expiration time
      );

      res.send({ status: "ok", serialNum, token });
    } else if (serialNum && serialNum.numOfChecks == 0) {
      res.send({
        status: "false",
        msg: "You can't check serial number more than 3 times",
      });
    }
  } catch (error) {
    res.status(500).send({ message: "An error occurred", error });
  }
});

/* activate serial */
app.post("/activation", async (req, res) => {
  const {
    name,
    phoneNumber,
    birthdate,
    address,
    brand,
    model,
    color,
    email,
    serialNumber,
    createdAt,
  } = req.body;
  try {
    const foundSerial = await Serial.findOne({ serialNumber });
    console.log("Found Serial:", foundSerial);

    if (!foundSerial) {
      return res.send({ msg: "not found" });
    }

    if (foundSerial.activated) {
      const activatedWarranty = await Warranty.findOne({ serialNumber });
      console.log(activatedWarranty);
      return res.send({
        msg: "activated",
        owner: {
          name: activatedWarranty.name.slice(0, 2),
          phoneNumber: String(activatedWarranty.phoneNumber).slice(-3),
        },
      });
    }

    foundSerial.activated = true;
    await foundSerial.save();

    const newActivation = new Warranty({
      name,
      phoneNumber,
      birthdate,
      address,
      brand,
      model,
      color,
      email,
      serialNumber,
      createdAt,
    });
    await newActivation.save();

    res.status(201).send({
      msg: "success",
      activation: newActivation,
    });
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

app.get("/activatedWarrantys", async (req, res) => {
  try {
    const warrantys = await Warranty.find({});

    if (warrantys.length === 0) {
      return res.status(404).send("No warrantys found");
    }
    res.status(200).json({ status: "ok", warrantys });
  } catch {
    res.status(500).send(`Error: ${err.message}`);
  }
});
// Delete activation by serial number and send all remaining activations
app.delete("/activation/:serialNumber", async (req, res) => {
  const { serialNumber } = req.params;

  try {
    // Find and delete the activation by serialNumber
    const deletedActivation = await Warranty.findOneAndDelete({ serialNumber });

    if (!deletedActivation) {
      return res.status(404).send({ msg: "Activation not found" });
    }

    // Retrieve all remaining activations
    const allActivations = await Warranty.find();

    res.status(200).send({
      msg: "Activation deleted successfully",
      deletedActivation,
      remainingActivations: allActivations,
    });
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});
// Delete all activations
app.delete("/activations", async (req, res) => {
  try {
    // Find and delete all activations
    const result = await Warranty.deleteMany({});

    if (result.deletedCount === 0) {
      return res.status(404).send({ msg: "No activations found to delete" });
    }

    // Retrieve all remaining activations (should be empty)
    const allActivations = await Warranty.find();

    res.status(200).send({
      msg: "All activations deleted successfully",
      remainingActivations: allActivations,
    });
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

/* offers */
app.post("/sendOffer", async (req, res) => {
  const { name, email, phone, msg } = req.body;
  try {
    if (name && email) {
      const newOffer = new Offer({
        name,
        email,
        phone,
        msg,
      });
      await newOffer.save();
      res.send({
        status: "ok",
        msg: "Request sent successfully",
      });
    } else {
      res.send({
        status: "false",
        msg: "wrong inputs",
      });
    }
  } catch (error) {
    res.status(500).send({ message: "An error occurred", error });
  }
});
app.post("/offerCheck", async (req, res) => {
  const { Id } = req.body;
  try {
    const newOffer = await Offer.findOne({ Id });

    if (!newOffer) {
      return res.status(404).send({ status: "false", msg: "Offer not found" });
    }

    newOffer.checked = true;
    await newOffer.save();
    const offers = await Offer.find({});

    res.send({ status: "ok", offers });
  } catch (error) {
    res.status(500).send({ message: "An error occurred", error });
  }
});
app.post("/offerUnCheck", async (req, res) => {
  const { Id } = req.body;
  try {
    const newOffer = await Offer.findOne({ Id });

    if (!newOffer) {
      return res.status(404).send({ status: "false", msg: "Offer not found" });
    }

    newOffer.checked = false;
    await newOffer.save();
    const offers = await Offer.find({});

    res.send({ status: "ok", offers });
  } catch (error) {
    res.status(500).send({ message: "An error occurred", error });
  }
});

app.get("/getOffers", async (req, res) => {
  try {
    const offers = await Offer.find({});
    res.send({ status: "ok", offers });
  } catch (error) {
    res.status(500).send({ message: "An error occurred", error });
  }
});
app.delete("/deleteOffers", async (req, res) => {
  try {
    await Offer.deleteMany({}); // Delete all documents in the Offer collection
    res.send({ status: "ok", msg: "All offers deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .send({ message: "An error occurred while deleting offers", error });
  }
});

app.post("/admin/register", async (req, res) => {
  console.log(req.body);
  const { username, password } = req.body;

  try {
    // Check if the admin already exists
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    // Create new admin
    const newAdmin = new Admin({ username, password });
    await newAdmin.save();

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the admin by username
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Check the password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "1h",
    });

    res.json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});
function authenticateToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, admin) => {
    if (err) return res.sendStatus(403);
    req.admin = admin;
    next();
  });
}

// Protected Admin Route
app.get("/admin/serials", authenticateToken, (req, res) => {
  res.json({ message: "Welcome to the admin dashboard!" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("port is 3000");
});
