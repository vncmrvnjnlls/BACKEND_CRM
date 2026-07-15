const express = require("express");
const router = express.Router();
const { getAllCalls, createCall, updateCall, deleteCall } = require("../controllers/callController");
const protect = require("../middleware/authMiddleware"); // Tiyaking tugma sa auth middleware mo

// Protektahan ang buong endpoints ng calls gamit ang auth token niyo
router.use(protect);

router.route("/").get(getAllCalls).post(createCall);
router.route("/:id").patch(updateCall).delete(deleteCall);

module.exports = router;