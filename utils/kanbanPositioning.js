/**
 * Kanban Card Positioning Utility
 * 
 * Manages the position of cards within Kanban columns (statuses/stages)
 * Handles reordering within columns and moving cards between columns
 * 
 * Key Concepts:
 *   - position: Integer representing order within a column (0 = top)
 *   - columnField: Database field that defines which column (e.g., 'status', 'stage')
 *   - Column value: The value of columnField that identifies the column
 * 
 * Three main responsibilities:
 * 
 * 1. reorderCards(config, updates)
 *    Rearrange cards within their current column
 *    Input: [{ _id, position }]
 * 
 * 2. moveCard(config, itemId, newColumn, newPosition)
 *    Move a card from one column to another
 *    Automatically shifts surrounding cards
 *    Does NOT touch business state (closedAt, completedAt, etc.)
 * 
 * 3. applyStatusUpdates(config, updates)
 *    Batch-write pre-resolved updates
 *    Used when all changes are already validated
 *    Input: [{ _id, ...anyFields }]
 * 
 * Config Object:
 *   {
 *     Model: Lead,           // Mongoose model
 *     columnField: 'status'  // Database field for column
 *   }
 * 
 * All functions throw errors with .status property for HTTP response codes
 * 
 * @example
 * const config = { Model: Lead, columnField: 'status' };
 * await moveCard(config, leadId, 'Qualified', 2);
 * // Lead moved to 'Qualified' status at position 2
 */

// ---------------------------------------------------------------------------
// reorderCards — arrange cards within their current column
// ---------------------------------------------------------------------------

/**
 * Apply position-only updates. Column never changes.
 * Deduplication and access checks are the caller's responsibility.
 *
 * @param {object} config
 * @param {Array<{ _id: string, position: number }>} updates
 */
const reorderCards = async (config, updates) => {
  const { Model } = config;

  const bulkOps = updates.map(({ _id, position }) => ({
    updateOne: {
      filter: { _id },
      update: { $set: { position } },
    },
  }));

  if (bulkOps.length > 0) {
    await Model.bulkWrite(bulkOps);
  }
};

// ---------------------------------------------------------------------------
// moveCard — move a card between columns
// ---------------------------------------------------------------------------

/**
 * Shift surrounding cards and place the card in its new column + position.
 * Does NOT touch any business-state fields (closedAt, completedAt, etc.).
 * The caller applies those separately.
 *
 * @param {object} config
 * @param {string} itemId
 * @param {string} newColumn   - target column value (already validated by caller)
 * @param {number} newPosition - target position in the new column (defaults to 0)
 */
const moveCard = async (config, itemId, newColumn, newPosition = 0) => {
  const { Model, columnField } = config;

  const item = await Model.findById(itemId).select(
    `_id ${columnField} position`,
  );

  if (!item) {
    throw Object.assign(new Error("Item not found"), { status: 404 });
  }

  const fromColumn = item[columnField];
  const fromPosition = item.position;

  if (fromColumn === newColumn && fromPosition === newPosition) return;

  const bulkOps = [];

  if (fromColumn !== newColumn) {
    // 1. Close the gap left behind in the source column
    bulkOps.push({
      updateMany: {
        filter: { [columnField]: fromColumn, position: { $gt: fromPosition } },
        update: { $inc: { position: -1 } },
      },
    });

    // 2. Open space in the target column
    bulkOps.push({
      updateMany: {
        filter: { [columnField]: newColumn, position: { $gte: newPosition } },
        update: { $inc: { position: 1 } },
      },
    });

    // 3. Place the card
    bulkOps.push({
      updateOne: {
        filter: { _id: itemId },
        update: { $set: { [columnField]: newColumn, position: newPosition } },
      },
    });
  } else {
    // Same column — shift cards between old and new position
    if (newPosition > fromPosition) {
      bulkOps.push({
        updateMany: {
          filter: {
            [columnField]: fromColumn,
            position: { $gt: fromPosition, $lte: newPosition },
          },
          update: { $inc: { position: -1 } },
        },
      });
    } else {
      bulkOps.push({
        updateMany: {
          filter: {
            [columnField]: fromColumn,
            position: { $gte: newPosition, $lt: fromPosition },
          },
          update: { $inc: { position: 1 } },
        },
      });
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: itemId },
        update: { $set: { position: newPosition } },
      },
    });
  }

  await Model.bulkWrite(bulkOps);
};

// ---------------------------------------------------------------------------
// applyStatusUpdates — write pre-resolved batch updates
// ---------------------------------------------------------------------------

/**
 * Write a batch of fully-resolved updates in one bulkWrite.
 * The caller decides every field — column, position, and any extra business
 * fields (closedAt, completedAt, etc.). This function is a pure writer.
 *
 * @param {object} config
 * @param {Array<{ _id: string, [field: string]: any }>} updates
 *   Each entry must include `_id`. All other keys go directly into $set.
 */
const applyStatusUpdates = async (config, updates) => {
  const { Model } = config;

  const bulkOps = updates.map(({ _id, ...fields }) => ({
    updateOne: {
      filter: { _id },
      update: { $set: fields },
    },
  }));

  if (bulkOps.length > 0) {
    await Model.bulkWrite(bulkOps);
  }
};

module.exports = { reorderCards, moveCard, applyStatusUpdates };
