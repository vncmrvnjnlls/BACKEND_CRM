const express = require("express");
const router = express.Router();
const {
  getAllMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
} = require("../controllers/meetingController");
const protect = require("../middleware/authMiddleware");

// Protektahan ang lahat ng meeting routes gamit ang login token
router.use(protect);

router.route("/").get(getAllMeetings).post(createMeeting);
router.route("/:id").patch(updateMeeting).delete(deleteMeeting);

module.exports = router;