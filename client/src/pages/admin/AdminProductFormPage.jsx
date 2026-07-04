import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import styles from './AdminProductFormPage.module.css';

const CATEGORIES = ['audio', 'keyboards', 'smart-home', 'desk', 'wearables', 'accessories'];

const EMPTY_FORM = {
  name: '',
  brand: '',
  category: 'audio',
  price: '', // whole kronor in the UI; öre on the wire
  countInStock: '',
  description: '',
  isFeatured: false,
};

/** Upload one file straight to Cloudinary using a server-issued signature. */
async function uploadToCloudinary(file) {
  const { data } = await api.post('/admin/uploads/signature');
  const { timestamp, signature, apiKey, cloudName, folder, allowedFormats } = data.data;

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', apiKey);
  body.append('timestamp', timestamp);
  body.append('signature', signature);
  body.append('folder', folder);
  // Signed on the server — must be sent verbatim or the signature mismatches.
  body.append('allowed_formats', allowedFormats);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body });
  const uploaded = await res.json();
  if (!res.ok) throw new Error(uploaded.error?.message ?? 'Upload failed');
  return uploaded.secure_url;
}

export default function AdminProductFormPage() {
  const { id } = useParams(); // present → edit mode
  const navigate = useNavigate();
  const addToast = useToast();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState([]); // [{ url, alt }]
  const [loading, setLoading] = useState(Boolean(id));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    api
      .get(`/admin/products/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        const product = data.data.product;
        setForm({
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: String(product.price / 100), // öre → kronor for editing
          countInStock: String(product.countInStock),
          description: product.description,
          isFeatured: product.isFeatured,
        });
        setImages(product.images);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        addToast(getErrorMessage(err), 'error');
        navigate('/admin/products', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [id, addToast, navigate]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      // Alt defaults to the product name; editable per image below.
      setImages((current) => [...current, { url, alt: form.name || 'Product photo' }]);
      addToast('Image uploaded');
    } catch (err) {
      // Axios errors carry the API envelope; plain Errors from the Cloudinary
      // fetch carry their own message.
      addToast(err.response ? getErrorMessage(err) : err.message, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setAlt = (index) => (e) =>
    setImages((current) => current.map((img, i) => (i === index ? { ...img, alt: e.target.value } : img)));

  const removeImage = (index) => setImages((current) => current.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) {
      addToast('Add at least one image', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      brand: form.brand,
      category: form.category,
      price: Math.round(Number(form.price) * 100), // kronor → integer öre
      countInStock: Number(form.countInStock),
      description: form.description,
      isFeatured: form.isFeatured,
      images,
    };
    try {
      const { data } = id
        ? await api.put(`/admin/products/${id}`, payload)
        : await api.post('/admin/products', payload);
      addToast(data.message);
      navigate('/admin/products');
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{id ? 'Edit product' : 'New product'}</h1>
        <Link to="/admin/products" className={styles.backLink}>← All products</Link>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid}>
          <Input id="name" label="Name" value={form.name} onChange={setField('name')} required minLength={2} maxLength={120} />
          <Input id="brand" label="Brand" value={form.brand} onChange={setField('brand')} required maxLength={60} />

          <div className={styles.field}>
            <label htmlFor="category" className={styles.selectLabel}>Category</label>
            <select id="category" className={styles.select} value={form.category} onChange={setField('category')}>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <Input id="price" label="Price (kr)" type="number" min="0" step="1" value={form.price} onChange={setField('price')} required />
            <Input id="countInStock" label="Stock" type="number" min="0" step="1" value={form.countInStock} onChange={setField('countInStock')} required />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.selectLabel}>Description</label>
          <textarea
            id="description"
            className={styles.textarea}
            value={form.description}
            onChange={setField('description')}
            required
            minLength={2}
            maxLength={2000}
            rows={5}
          />
        </div>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
          />
          Featured on the homepage
        </label>

        <section aria-labelledby="images-heading" className={styles.imagesSection}>
          <h2 id="images-heading">Images</h2>
          <ul className={styles.imageList}>
            {images.map((image, index) => (
              <li key={image.url} className={styles.imageRow}>
                <img src={image.url} alt="" />
                <Input
                  id={`alt-${index}`}
                  label="Alt text"
                  value={image.alt}
                  onChange={setAlt(index)}
                  required
                  minLength={2}
                  maxLength={200}
                />
                <button type="button" className={styles.removeImage} onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <label className={styles.uploadButton}>
            {uploading ? 'Uploading…' : '+ Upload image'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className={styles.fileInput}
            />
          </label>
        </section>

        <Button type="submit" isLoading={saving} disabled={uploading}>
          {id ? 'Save changes' : 'Create product'}
        </Button>
      </form>
    </main>
  );
}
