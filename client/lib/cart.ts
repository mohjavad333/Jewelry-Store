export type CartItem = {
  id: number;
  name: string;
  price: number;
  weight: number;
  karat?: number;
  image: string;
  quantity: number;
  reservedUntil: number;
  customization?: string;
};

const CART_KEY = "zarinsa-cart";
const CART_EVENT = "zarinsa-cart-updated";

export function getCart(): CartItem[] {
  try {
    const stored = window.localStorage.getItem(CART_KEY);
    return stored ? (JSON.parse(stored) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function addToCart(item: Omit<CartItem, "quantity" | "reservedUntil">, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((cartItem) => cartItem.id === item.id && cartItem.customization === item.customization);
  const next = existing
    ? cart.map((cartItem) => cartItem === existing ? { ...cartItem, quantity: cartItem.quantity + quantity, reservedUntil: Date.now() + 15 * 60 * 1000 } : cartItem)
    : [...cart, { ...item, quantity, reservedUntil: Date.now() + 15 * 60 * 1000 }];
  saveCart(next);
}

export function cartEventName() {
  return CART_EVENT;
}
