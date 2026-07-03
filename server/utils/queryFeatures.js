/**
 * Translates catalog query-string params into Mongoose query pieces.
 * Kept out of the controller so the shape of the public API (?category=,
 * ?search=, ?sort=…) is documented in one place.
 */

// User input must never be interpreted as regex syntax.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SORT_OPTIONS = {
  newest: '-createdAt',
  'price-asc': 'price',
  'price-desc': '-price',
  rating: '-rating -numReviews',
};

export const MAX_PAGE_SIZE = 48;
export const DEFAULT_PAGE_SIZE = 12;

export const buildProductQuery = (query) => {
  const filter = {};

  if (query.category) filter.category = query.category;

  // Prices arrive in öre (integer), same unit they're stored in.
  if (query.minPrice || query.maxPrice) {
    filter.price = {
      ...(query.minPrice && { $gte: Number(query.minPrice) }),
      ...(query.maxPrice && { $lte: Number(query.maxPrice) }),
    };
  }

  // Case-insensitive contains-match across the fields users search by.
  // Regex over a text index because the search box sends prefixes
  // ("keyb…") which $text cannot match. Fine at catalog scale.
  if (query.search) {
    const re = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ name: re }, { brand: re }, { description: re }];
  }

  const sort = SORT_OPTIONS[query.sort] ?? SORT_OPTIONS.newest;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Number(query.limit) || DEFAULT_PAGE_SIZE);

  return { filter, sort, page, limit, skip: (page - 1) * limit };
};
