/**
 * Role-based access control middleware
 * Checks if the authenticated user has one of the required roles
 * Prevents unauthorized users from accessing admin or manager-only routes
 * 
 * @param {...string} roles - Allowed roles (e.g., 'Admin', 'Sales Manager', 'Sales Agent')
 * @returns {Function} Express middleware function
 * @throws {Error} Returns 401 if not authenticated, 403 if insufficient permissions
 * 
 */
module.exports = function (...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized, please login" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied, insufficient permissions",
      });
    }
    next();
  };
};
