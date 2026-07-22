const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Team = require("../models/Team");
const PasswordResetToken = require("../models/PasswordResetToken");
const { sendPasswordResetEmail } = require("../services/emailService");

const ACCESS_TOKEN_EXPIRY = "1d";
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

const signAccessToken = (user) =>
  jwt.sign(
    {
      userId: user._id,
      role: user.role,
      teamId: user.team?._id || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );

const generateRawRefreshToken = () => crypto.randomBytes(64).toString("hex");

const refreshCookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  maxAge: REFRESH_TOKEN_EXPIRY,
  path: "/",
};

const clearRefreshCookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  path: "/",
};

const setRefreshCookie = (res, rawToken) => {
  res.cookie("refreshToken", rawToken, refreshCookieOptions);
};

const clearRefreshCookie = (res) => {
  res.clearCookie("refreshToken", clearRefreshCookieOptions);
};

const formatUser = async (user) => {
  const managedTeam =
    user.role === "Sales Manager"
      ? await Team.findOne({
          manager: user._id,
          isActive: true,
        }).select("_id name")
      : null;

  return {
    id: user._id,

    team: user.team
      ? {
          _id: user.team._id,
          name: user.team.name,
        }
      : null,

    managedTeam: managedTeam
      ? {
          _id: managedTeam._id,
          name: managedTeam.name,
        }
      : null,

    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    suffixName: user.suffixName,
    email: user.email,
    role: user.role,
    profilePicture: user.profilePicture,
    phone: user.phone,
    status: user.status,
    accessModules: Array.isArray(user.accessModules) ? user.accessModules : [],
  };
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email })
      .select("+password")
      .populate("team", "name");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const accessToken = signAccessToken(user);

    const rawRefreshToken = generateRawRefreshToken();

    await RefreshToken.create({
      user: user._id,
      tokenHash: RefreshToken.hashToken(rawRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
      userAgent: req.headers["user-agent"] || "",
    });

    setRefreshCookie(res, rawRefreshToken);

    return res.status(200).json({
      accessToken,
      user: await formatUser(user),
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.refresh = async (req, res) => {
  try {
    const rawToken = req.cookies?.refreshToken;

    if (!rawToken) {
      return res.status(401).json({ message: "No refresh token" });
    }

    const tokenHash = RefreshToken.hashToken(rawToken);

    const stored = await RefreshToken.findOne({
      tokenHash,
      isRevoked: false,
    });

    if (!stored || stored.expiresAt < new Date()) {
      clearRefreshCookie(res);

      return res.status(401).json({
        message: "Refresh token expired, please log in again",
      });
    }

    const user = await User.findById(stored.user).populate("team", "name");

    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "User not found" });
    }

    stored.isRevoked = true;
    await stored.save();

    const newRawRefreshToken = generateRawRefreshToken();

    await RefreshToken.create({
      user: user._id,
      tokenHash: RefreshToken.hashToken(newRawRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
      userAgent: req.headers["user-agent"] || "",
    });

    setRefreshCookie(res, newRawRefreshToken);

    return res.status(200).json({
      accessToken: signAccessToken(user),
      user: await formatUser(user),
    });
  } catch (error) {
    console.error("REFRESH ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const rawToken = req.cookies?.refreshToken;

    if (rawToken) {
      await RefreshToken.findOneAndUpdate(
        { tokenHash: RefreshToken.hashToken(rawToken) },
        { isRevoked: true },
      );
    }

    clearRefreshCookie(res);

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        message: "If that email exists, a reset link was sent.",
      });
    }

    await PasswordResetToken.deleteMany({ user: user._id });

    const rawToken = crypto.randomBytes(32).toString("hex");

    await PasswordResetToken.create({
      user: user._id,
      tokenHash: PasswordResetToken.hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      firstName: user.firstName,
    });

    return res.status(200).json({
      message: "If that email exists, a reset link was sent.",
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: "Token and new password are required.",
      });
    }

    const tokenHash = PasswordResetToken.hashToken(token);

    const record = await PasswordResetToken.findOne({
      tokenHash,
      usedAt: null,
    });

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({
        error: "Reset link is invalid or has expired.",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(record.user, {
      password: hashed,
    });

    record.usedAt = new Date();
    await record.save();

    await RefreshToken.updateMany(
      { user: record.user },
      { isRevoked: true },
    );

    return res.status(200).json({
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
};