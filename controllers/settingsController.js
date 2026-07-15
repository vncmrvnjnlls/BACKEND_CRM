const User = require("../models/User");
const bcrypt = require("bcryptjs");

const TEAM_POPULATE = {
  path: "team",
  select: "name isActive manager agents",
  populate: [
    {
      path: "manager",
      select: "firstName middleName lastName suffixName",
    },
    {
      path: "agents",
      select: "_id",
    },
  ],
};

const getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate(TEAM_POPULATE);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Get settings error:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      suffixName,
      email,
      phone,
      sex,
      dateOfBirth,
      placeOfBirth,
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          firstName,
          middleName,
          lastName,
          suffixName,
          email,
          phone,
          sex,
          dateOfBirth,
          placeOfBirth,
        },
      },
      { new: true, runValidators: true },
    ).populate(TEAM_POPULATE);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(400).json({
        error: "Email already exists. Please use a different email.",
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ error: errors });
    }

    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const isPasswordFilled = currentPassword || newPassword || confirmPassword;

    if (!isPasswordFilled) {
      return res.status(200).json({ message: "No password changes" });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res
        .status(400)
        .json({ error: "All password fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "New password do not match" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }

    const user = await User.findById(req.user.userId).select("+password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ error: "Failed to update password" });
  }
};

const updateAddress = async (req, res) => {
  try {
    const {
      houseNumber,
      street,
      barangay,
      municipality,
      province,
      zipCode,
      country,
    } = req.body;

    if (!municipality || !province || !zipCode || !country) {
      return res.status(400).json({
        error: "Municipality, province, zip code, and country are required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          currentAddress: {
            houseNumber,
            street,
            barangay,
            municipality,
            province,
            zipCode,
            country,
          },
        },
      },
      { new: true, runValidators: true },
    ).populate(TEAM_POPULATE);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({ error: "Failed to update address" });
  }
};

const updatePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const profilePicture = `/uploads/profile_pictures/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { profilePicture } },
      { new: true },
    ).populate(TEAM_POPULATE);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Update photo error:", error);
    res.status(500).json({ error: "Failed to update photo" });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const {
      emailTaskAssignment,
      emailTaskReminder,
      emailDealUpdate,
      emailLeadUpdate,
      emailTeamMention,
      emailSystemAlert,
      inAppTaskAssignment,
      inAppTaskReminder,
      inAppDealUpdate,
      inAppLeadUpdate,
      inAppTeamMention,
      inAppSystemAlert,
      notificationFrequency,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      notificationSound,
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $set: {
          notificationPreferences: {
            emailTaskAssignment,
            emailTaskReminder,
            emailDealUpdate,
            emailLeadUpdate,
            emailTeamMention,
            emailSystemAlert,
            inAppTaskAssignment,
            inAppTaskReminder,
            inAppDealUpdate,
            inAppLeadUpdate,
            inAppTeamMention,
            inAppSystemAlert,
            notificationFrequency,
            quietHoursEnabled,
            quietHoursStart,
            quietHoursEnd,
            notificationSound,
          },
        },
      },
      { new: true, runValidators: true },
    ).populate(TEAM_POPULATE);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      message: "Notification preferences updated successfully",
      notificationPreferences: user.notificationPreferences,
    });
  } catch (error) {
    console.error("Update notification preferences error:", error);
    res
      .status(500)
      .json({ error: "Failed to update notification preferences" });
  }
};

module.exports = {
  getSettings,
  updateProfile,
  updatePassword,
  updateAddress,
  updatePhoto,
  updateNotificationPreferences,
};
