/**
 * Translates catalog query-string params into Mongoose query pieces.
 * Kept out of the controller so the shape of the public API (?category=,
 * ?search=, ?sort=…) is documented in one place.
 */

// User input must never be interpreted as regex syntax.
const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const SORT_OPTIONS: Record<string, string> = {
  newest: '-createdAt',
  'price-asc': 'price',
  'price-desc': '-price',
  rating: '-rating -numReviews',
};

export const MAX_PAGE_SIZE = 48;
export const DEFAULT_PAGE_SIZE = 12;

type QueryParams = Record<string, unknown>;

const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export const buildProductQuery = (query: QueryParams) => {
  const filter: Record<string, unknown> = {};

  const category = asString(query.category);
  if (category) filter.category = category;

  // Prices arrive in öre (integer), same unit they're stored in.
  const minPrice = asString(query.minPrice);
  const maxPrice = asString(query.maxPrice);
  if (minPrice || maxPrice) {
    filter.price = {
      ...(minPrice && { $gte: Number(minPrice) }),
      ...(maxPrice && { $lte: Number(maxPrice) }),
    };
  }

  // Case-insensitive contains-match across the fields users search by.
  // Regex over a text index because the search box sends prefixes
  // ("keyb…") which $text cannot match. Fine at catalog scale.
  const search = asString(query.search);
  if (search) {
    const re = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: re }, { brand: re }, { description: re }];
  }

  const sort = SORT_OPTIONS[asString(query.sort) ?? ''] ?? SORT_OPTIONS.newest;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Number(query.limit) || DEFAULT_PAGE_SIZE);

  return { filter, sort, page, limit, skip: (page - 1) * limit };
};
