const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = {
      ...user.toObject(),
      id: user._id,
      userId: user._id,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Middleware para siguraduhing ADMIN LANG ang may access sa endpoint
const adminOnly = (req, res, next) => {
  if (req.user && ["Super Admin", "Admin"].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied. Only system administrators can manage user permissions.",
    });
  }
};

module.exports = protect;
module.exports.protect = protect;
module.exports.adminOnly = adminOnly;