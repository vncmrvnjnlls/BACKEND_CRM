const Prospect = require("../models/prospectModel");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Activity = require("../models/Activity"); // <-- Added Activity model import

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
  const admin = await User.findOne({ role: { $in: ["Super Admin", "Admin"] } }).select("_id");

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
    case "Other":
    case "Others":
      return "Other";
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

const normalizeProspectPayload = (reqBody = {}) => {
  const representative = reqBody.representativeName || {};
  const owner = reqBody.ownerName || {};
  
  const rawAddress = reqBody.address || reqBody.businessAddress || {};
  const province = rawAddress.province || reqBody.province || "";
  const municipality = rawAddress.municipality || rawAddress.city || reqBody.city || "";
  const barangay = rawAddress.barangay || rawAddress.district || reqBody.barangay || "";
  const street = rawAddress.street || rawAddress.streetAddress || reqBody.street || "";
  const houseNumber = rawAddress.houseNumber || reqBody.houseNumber || "";
  const zipCode = rawAddress.zipCode || reqBody.zipCode || "";
  const country = rawAddress.country || reqBody.country || "Philippines";

  const regionCode = rawAddress.regionCode || reqBody.regionCode || "";
  const provinceCode = rawAddress.provinceCode || reqBody.provinceCode || "";
  const municipalityCode = rawAddress.municipalityCode || rawAddress.cityCode || reqBody.municipalityCode || "";
  const barangayCode = rawAddress.barangayCode || reqBody.barangayCode || "";
  const isNCRCity = rawAddress.isNCRCity || reqBody.isNCRCity || false;

  const companyName = reqBody.companyName || reqBody.company || "";
  const companyEmailAddress =
    reqBody.companyEmailAddress || reqBody.companyEmail || reqBody.emailAddress || reqBody.email || "";
  const companyWebsite = reqBody.companyWebsite || "";
  const natureOfBusiness = reqBody.natureOfBusiness || reqBody.industry || "";
  const emailAddress = reqBody.emailAddress || reqBody.email || companyEmailAddress || "";
  const phone = reqBody.phone || "";
  const firstName = reqBody.firstName || representative.firstName || "";
  const middleName = reqBody.middleName || representative.middleName || representative.middleInitial || "";
  const lastName = reqBody.lastName || representative.lastName || "";

  return {
    companyName,
    companyEmailAddress,
    companyWebsite,
    natureOfBusiness,
    numberOfEmployees: reqBody.numberOfEmployees || "",
    ownerName: {
      firstName: owner.firstName || "",
      middleName: owner.middleName || owner.middleInitial || "",
      middleInitial: owner.middleName || owner.middleInitial || "",
      lastName: owner.lastName || "",
    },
    representativeName: {
      firstName: representative.firstName || firstName || "",
      middleName: representative.middleName || representative.middleInitial || middleName || "",
      middleInitial: representative.middleName || representative.middleInitial || middleName || "",
      lastName: representative.lastName || lastName || "",
      suffixName: representative.suffixName || "",
      birthday: representative.birthday || reqBody.birthday || "",
      gender: representative.gender || reqBody.gender || "",
    },
    title: reqBody.title || "",
    emailAddress,
    viber: reqBody.viber || "",
    phone,
    businessAddress: {
      houseNumber,
      streetAddress: street,
      city: municipality,
      province,
      country,
    },
    address: {
      country,
      province,
      municipality,
      barangay,
      street,
      houseNumber,
      zipCode,
      regionCode,
      provinceCode,
      municipalityCode,
      barangayCode,
      isNCRCity,
    },
    status: reqBody.status || "New",
    leadSource: reqBody.leadSource || "Website",
    notes: reqBody.notes || "",
    handlingOfficer: reqBody.handlingOfficer || null,
  };
};

const getProspects = async (req, res) => {
  try {
    const prospects = await Prospect.find()
      .populate(
        "createdBy",
        "firstName lastName email role profilePicture avatar"
      )
      .populate(
        "handlingOfficer",
        "firstName lastName email role profilePicture avatar"
      )
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

    const payload = normalizeProspectPayload(req.body);

    payload.companyEmailAddress = cleanEmptyString(payload.companyEmailAddress) || undefined;
    payload.emailAddress = cleanEmptyString(payload.emailAddress) || undefined;
    payload.phone = cleanEmptyString(payload.phone);
    payload.createdBy = userId;

    const prospect = await Prospect.create(payload);

    // --- LOG CREATE ACTIVITY ---
    if (userId) {
      await Activity.create({
        relatedToType: "Prospect",
        relatedToId: prospect._id,
        action: "CREATE",
        title: "created this prospect",
        createdBy: userId,
        activityDate: new Date(),
      }).catch((err) => console.error("Activity create error:", err));
    }

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

    const payload = normalizeProspectPayload(req.body);

    payload.companyEmailAddress = cleanEmptyString(payload.companyEmailAddress) || undefined;
    payload.emailAddress = cleanEmptyString(payload.emailAddress) || undefined;
    payload.phone = cleanEmptyString(payload.phone);

    let prospect = await Prospect.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!prospect) {
      return res.status(404).json({
        success: false,
        message: "Prospect not found",
      });
    }

    prospect = await Prospect.findById(prospect._id)
      .populate("createdBy", "firstName lastName email role profilePicture avatar")
      .populate("handlingOfficer", "firstName lastName email role profilePicture avatar");

    // --- LOG UPDATE ACTIVITY ---
    let userId = getUserId(req, prospect);
    if (!userId) {
      userId = await getFallbackUserId();
    }

    if (userId) {
      await Activity.create({
        relatedToType: "Prospect",
        relatedToId: prospect._id,
        action: "UPDATE",
        title: "updated prospect details",
        createdBy: userId,
        activityDate: new Date(),
      }).catch((err) => console.error("Activity update error:", err));
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

    // Prefer prospect.address (form input) and fallback to businessAddress
    const addr = prospect.address || {};
    const busAddr = prospect.businessAddress || {};

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
        houseNumber: addr.houseNumber || busAddr.houseNumber || "",
        street: addr.street || busAddr.streetAddress || "",
        barangay: addr.barangay || "",
        municipality: addr.municipality || busAddr.city || "",
        province: addr.province || busAddr.province || "",
        zipCode: addr.zipCode || "",
        country: addr.country || busAddr.country || "Philippines",
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