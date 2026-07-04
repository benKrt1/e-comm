import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import { formatPrice } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import placeholder from '../../assets/placeholder-product.svg';
import styles from './AdminProductsPage.module.css';

export default function AdminProductsPage() {
  const addToast = useToast();
  const [products, setProducts] = useState(null);
  // Two-click delete: first click arms the row, second click commits.
  // (No window.confirm — blocking dialogs are hostile to users and tests.)
  const [armedId, setArmedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // limit=48 is the public API's maximum page size (queryFeatures rejects
    // more). The seed has 24 products, so one page covers everything —
    // admin-table pagination is out of scope (documented trade-off).
    api
      .get('/products?limit=48')
      .then(({ data }) => !cancelled && setProducts(data.data.products))
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (product) => {
    if (armedId !== product._id) {
      setArmedId(product._id);
      return;
    }
    setDeletingId(product._id);
    try {
      await api.delete(`/admin/products/${product._id}`);
      setProducts((current) => current.filter((item) => item._id !== product._id));
      addToast(`${product.name} deleted`);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setDeletingId(null);
      setArmedId(null);
    }
  };

  if (products === null) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Products <span>({products.length})</span></h1>
        <Link to="/admin/products/new" className={styles.newButton}>
          + New product
        </Link>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Featured</th>
              <th scope="col"><span className={styles.srOnly}>Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id}>
                <td>
                  <div className={styles.productCell}>
                    <img
                      src={product.images[0]?.url ?? placeholder}
                      alt=""
                      onError={(e) => (e.currentTarget.src = placeholder)}
                    />
                    <span>{product.name}</span>
                  </div>
                </td>
                <td>{product.category}</td>
                <td className={styles.num}>{formatPrice(product.price)}</td>
                <td className={`${styles.num} ${product.countInStock <= 5 ? styles.low : ''}`.trim()}>
                  {product.countInStock}
                </td>
                <td>{product.isFeatured ? '★' : ''}</td>
                <td>
                  <div className={styles.actions}>
                    <Link to={`/admin/products/${product._id}/edit`} className={styles.edit}>
                      Edit
                    </Link>
                    <button
                      className={armedId === product._id ? styles.confirmDelete : styles.delete}
                      onClick={() => handleDelete(product)}
                      onBlur={() => setArmedId((id) => (id === product._id ? null : id))}
                      disabled={deletingId === product._id}
                    >
                      {armedId === product._id ? 'Confirm?' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
