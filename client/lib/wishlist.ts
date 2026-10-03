const WISHLIST_KEY = "zarinsa-wishlist";
const WISHLIST_EVENT = "zarinsa-wishlist-updated";

export function getWishlist(): number[] { try { const value = window.localStorage.getItem(WISHLIST_KEY); return value ? JSON.parse(value) as number[] : []; } catch { return []; } }
export function toggleWishlist(id: number) { const current = getWishlist(); const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(next)); window.dispatchEvent(new Event(WISHLIST_EVENT)); return next; }
export function wishlistEventName() { return WISHLIST_EVENT; }
