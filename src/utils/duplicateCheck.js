import db from "../db/database";

/**
 * Checks if a username or mobile number already exists.
 * Pass excludeId when editing an existing customer (to skip self-match).
 * Returns: { hasDuplicate: bool, field: 'userName'|'mobileNo'|null, existing: customer|null }
 */
export const checkDuplicate = async (userName, mobileNo, excludeId = null) => {
  const all = await db.customers.toArray();

  if (userName && userName.trim()) {
    const normalised = userName.trim().toLowerCase();
    const match = all.find(
      (c) => c.userName?.toLowerCase() === normalised && c.id !== excludeId,
    );
    if (match)
      return { hasDuplicate: true, field: "userName", existing: match };
  }

  if (mobileNo && String(mobileNo).replace(/\D/g, "").length >= 10) {
    const cleaned = String(mobileNo).replace(/\D/g, "");
    const match = all.find(
      (c) =>
        String(c.mobileNo).replace(/\D/g, "") === cleaned && c.id !== excludeId,
    );
    if (match)
      return { hasDuplicate: true, field: "mobileNo", existing: match };
  }

  return { hasDuplicate: false, field: null, existing: null };
};
