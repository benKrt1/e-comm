'use client';

import { useState, useRef, type ChangeEvent, type SubmitEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import { getErrorMessage } from '@/lib/errors';
import { createProductAction, updateProductAction, getUploadSignatureAction } from '@/actions/admin';
import { PRODUCT_CATEGORIES } from '@/lib/categories';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { SerializedProduct } from '@/types';
import styles from './AdminProductFormPage.module.css';

interface ProductImage {
  url: string;
  alt: string;
}

/** Upload one file straight to Cloudinary using a server-issued signature. */
async function uploadToCloudinary(file: File): Promise<string> {
  const sig = await getUploadSignatureAction();
  if (!sig.success || !sig.data) throw new Error(sig.message);
  const { timestamp, signature, apiKey, cloudName, folder, allowedFormats } = sig.data;

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', apiKey);
  body.append('timestamp', String(timestamp));
  body.append('signature', signature);
  body.append('folder', folder);
  // Signed on the server — must be sent verbatim or the signature mismatches.
  body.append('allowed_formats', allowedFormats);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body });
  const uploaded = await res.json();
  if (!res.ok) throw new Error(uploaded.error?.message ?? 'Upload failed');
  return uploaded.secure_url as string;
}

export default function AdminProductForm({ product }: { product?: SerializedProduct }) {
  const router = useRouter();
  const addToast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(product);

  const [form, setForm] = useState({
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    category: product?.category ?? 'audio',
    price: product ? String(product.price / 100) : '', // öre → kronor for editing
    countInStock: product ? String(product.countInStock) : '',
    description: product?.description ?? '',
    isFeatured: product?.isFeatured ?? false,
  });
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const setField = (field: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      // Alt defaults to the product name; editable per image below.
      setImages((current) => [...current, { url, alt: form.name || 'Product photo' }]);
      addToast('Image uploaded');
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const setAlt = (index: number) => (e: ChangeEvent<HTMLInputElement>) =>
    setImages((current) => current.map((img, i) => (i === index ? { ...img, alt: e.target.value } : img)));

  const removeImage = (index: number) => setImages((current) => current.filter((_, i) => i !== index));

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (images.length === 0) {
      addToast('Add at least one image', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      brand: form.brand,
      category: form.category as SerializedProduct['category'],
      price: Math.round(Number(form.price) * 100), // kronor → integer öre
      countInStock: Number(form.countInStock),
      description: form.description,
      isFeatured: form.isFeatured,
      images,
    };
    const result = product ? await updateProductAction(product._id, payload) : await createProductAction(payload);
    if (result.success) {
      addToast(result.message);
      router.push('/admin/products');
      router.refresh();
    } else {
      addToast(result.message, 'error');
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{editing ? 'Edit product' : 'New product'}</h1>
        <Link href="/admin/products" className={styles.backLink}>
          ← All products
        </Link>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid}>
          <Input id="name" label="Name" value={form.name} onChange={setField('name')} required minLength={2} maxLength={120} />
          <Input id="brand" label="Brand" value={form.brand} onChange={setField('brand')} required maxLength={60} />

          <div className={styles.field}>
            <label htmlFor="category" className={styles.selectLabel}>
              Category
            </label>
            <select id="category" className={styles.select} value={form.category} onChange={setField('category')}>
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <Input id="price" label="Price (kr)" type="number" min="0" step="1" value={form.price} onChange={setField('price')} required />
            <Input id="countInStock" label="Stock" type="number" min="0" step="1" value={form.countInStock} onChange={setField('countInStock')} required />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="description" className={styles.selectLabel}>
            Description
          </label>
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                <button
                  type="button"
                  className={styles.removeImage}
                  onClick={() => removeImage(index)}
                  aria-label={`Remove image ${index + 1}`}
                >
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
          {editing ? 'Save changes' : 'Create product'}
        </Button>
      </form>
    </main>
  );
}
