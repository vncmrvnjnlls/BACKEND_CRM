const Prospect = require("../models/prospectModel");
const Lead = require("../models/Lead");
const User = require("../models/User");

const cleanEmptyString = (value) => {
  if (value === "") return undefined;
  return value;
};

const getUserId = (req, prospect = null) => {
  return (
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    prospect?.createdBy ||
    null
  );
};

const getFallbackUserId = async () => {
  const admin = await User.findOne({ role: "Admin" }).select("_id");

  if (admin) {
    return admin._id;
  }

  const anyUser = await User.findOne().select("_id");

  if (anyUser) {
    return anyUser._id;
  }

  return null;
};

const mapLeadSource = (source) => {
  switch (source) {
    case "Website":
      return "Website";
    case "Referral":
      return "Referral";
    case "Facebook":
    case "Social Media":
      return "Social Media";
    case "Email":
    case "Email Campaign":
      return "Email Campaign";
    case "Walk-in":
      return "Walk-in";
    case "Phone Call":
    case "Event":
    case "Manual Input":
      return "Manual Input";
    default:
      return "Other";
  }
};

const getLeadNameFromProspect = (prospect) => {
  const representative = prospect.representativeName || {};
  const owner = prospect.ownerName || {};

  return {
    firstName:
      representative.firstName ||
      owner.firstName ||
      prospect.companyName ||
      "Unknown",

    middleName:
      representative.middleInitial ||
      owner.middleInitial ||
      "",

    lastName:
      representative.lastName ||
      owner.lastName ||
      "Prospect",
  };
};

const getProspects = async (req, res) => {
  try {
    const prospects = await Prospect.find()
      .populate("createdBy", "firstName lastName email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      prospects,
    });
  } catch (error) {
    console.error("Get prospects error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load prospects",
    });
  }
};

const createProspect = async (req, res) => {
  try {
    let userId = getUserId(req);

    if (!userId) {
      userId = await getFallbackUserId();
    }

    const payload = {
      companyName: req.body.companyName,
      businessAddress: req.body.businessAddress,
      companyEmailAddress: req.body.companyEmailAddress,
      companyWebsite: req.body.companyWebsite,
      natureOfBusiness: req.body.natureOfBusiness,
      numberOfEmployees: req.body.numberOfEmployees,

      ownerName: req.body.ownerName,
      representativeName: req.body.representativeName,
      title: req.body.title,
      emailAddress: cleanEmptyString(req.body.emailAddress),
      viber: req.body.viber,
      phone: req.body.phone,

      status: req.body.status || "New",
      leadSource: req.body.leadSource || "Website",
      notes: req.body.notes,
      createdBy: userId,
    };

    const prospect = await Prospect.create(payload);

    res.status(201).json({
      success: true,
      message: "Prospect created successfully",
      prospect,
    });
  } catch (error) {
    console.error("Create prospect error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];

      return res.status(400).json({
        success: false,
        message: `${field || "Field"} already exists`,
      });
    }

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");

      return res.status(400).json({
        success: false,
        message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create prospect",
    });
  }
};

const updateProspect = async (req, res) => {
  try {
    const { id } = req.params;

    const payload = {
      ...req.body,
      emailAddress: cleanEmptyString(req.body.emailAddress),
    };

    const prospect = await Prospect.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!prospect) {
      return res.status(404).json({
        success: false,
        message: "Prospect not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Prospect updated successfully",
      prospect,
    });
  } catch (error) {
    console.error("Update prospect error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];

      return res.status(400).json({
        success: false,
        message: `${field || "Field"} already exists`,
      });
    }

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");

      return res.status(400).json({
        success: false,
        message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update prospect",
    });
  }
};

const deleteProspect = async (req, res) => {
  try {
    const { id } = req.params;

    const prospect = await Prospect.findByIdAndDelete(id);

    if (!prospect) {
      return res.status(404).json({
        success: false,
        message: "Prospect not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Prospect deleted successfully",
    });
  } catch (error) {
    console.error("Delete prospect error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete prospect",
    });
  }
};

const markAsContacted = async (req, res) => {
  try {
    const { id } = req.params;

    const prospect = await Prospect.findById(id);

    if (!prospect) {
      return res.status(404).json({
        success: false,
        message: "Prospect not found",
      });
    }

    let userId = getUserId(req, prospect);

    if (!userId) {
      userId = await getFallbackUserId();
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Cannot move prospect to leads because no user exists in the database.",
      });
    }

    const leadName = getLeadNameFromProspect(prospect);

    const lead = await Lead.create({
      leadOwner: userId,
      leadAssignee: userId,
      assignedAt: new Date(),

      firstName: leadName.firstName,
      middleName: leadName.middleName,
      lastName: leadName.lastName,

      email: prospect.emailAddress || prospect.companyEmailAddress || "",
      phone: prospect.phone || "",
      company: prospect.companyName || "",
      leadSource: mapLeadSource(prospect.leadSource),
      status: "Contacted",
      industry: prospect.natureOfBusiness || "",

      address: {
        houseNumber: prospect.businessAddress?.houseNumber || "",
        street: prospect.businessAddress?.streetAddress || "",
        barangay: "",
        municipality: prospect.businessAddress?.city || "",
        province: prospect.businessAddress?.province || "",
        zipCode: "",
        country: prospect.businessAddress?.country || "Philippines",
      },

      notes: prospect.notes || "",
      position: 0,
    });

    await Prospect.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      moved: true,
      message: "Prospect moved to Leads successfully",
      prospectId: id,
      lead,
    });
  } catch (error) {
    console.error("Move prospect to leads error:", error);

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");

      return res.status(400).json({
        success: false,
        message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to move prospect to leads",
      error: error.message,
    });
  }
};

module.exports = {
  getProspects,
  createProspect,
  updateProspect,
  deleteProspect,
  markAsContacted,
};