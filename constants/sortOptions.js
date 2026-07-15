/**
 * Common sorting options used across the system
 */

const USER_DEFAULT_SORT = {
  status: 1,
  firstName: 1,
  lastName: 1,
  createdAt: -1,
};

const LEAD_DEFAULT_SORT = {
  firstName: 1,
  lastName: 1,
  createdAt: -1,
};

const CUSTOMER_DEFAULT_SORT = {
  status: 1,
  firstName: 1,
  lastName: 1,
  createdAt: -1,
};

const DEAL_DEFAULT_SORT = {
  title: 1,
  createdAt: -1,
};

const TEAM_DEFAULT_FIRST_SORT = {
  isActive: -1, // true first
  name: 1,
  createdAt: -1,
};

module.exports = {
  USER_DEFAULT_SORT,
  LEAD_DEFAULT_SORT,
  CUSTOMER_DEFAULT_SORT,
  DEAL_DEFAULT_SORT,
  TEAM_DEFAULT_FIRST_SORT,
};
