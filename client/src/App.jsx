import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/layout/Navbar';
import PageTransition from './components/layout/PageTransition';
import ProtectedRoute from './components/layout/ProtectedRoute';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import OrdersPage from './pages/OrdersPage';
import OrderPage from './pages/OrderPage';
import WishlistPage from './pages/WishlistPage';
import NotFoundPage from './pages/NotFoundPage';

/** Shorthand: every page mounts inside the shared enter/exit transition. */
const page = (element) => <PageTransition>{element}</PageTransition>;

export default function App() {
  const location = useLocation();

  return (
    <>
      <Navbar />
      {/* mode="wait": the leaving page finishes its exit animation before
          the next one enters — keyed by pathname so route changes trigger it. */}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={page(<HomePage />)} />
          <Route path="/products" element={page(<CatalogPage />)} />
          <Route path="/products/:slug" element={page(<ProductPage />)} />
          <Route path="/cart" element={page(<CartPage />)} />
          <Route path="/login" element={page(<LoginPage />)} />
          <Route path="/register" element={page(<RegisterPage />)} />
          <Route element={<ProtectedRoute routesLocation={location} />}>
            <Route path="/profile" element={page(<ProfilePage />)} />
            <Route path="/checkout" element={page(<CheckoutPage />)} />
            <Route path="/orders" element={page(<OrdersPage />)} />
            <Route path="/orders/:id" element={page(<OrderPage />)} />
            <Route path="/wishlist" element={page(<WishlistPage />)} />
          </Route>
          <Route path="*" element={page(<NotFoundPage />)} />
        </Routes>
      </AnimatePresence>
    </>
  );
}
