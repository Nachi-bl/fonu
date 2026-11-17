import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { imagePreview, type Product } from '../api';
const productPhotos: Record<string, string> = {
  'STK-001': 'headphones.jpg',
  'STK-002': 'desk-lamp.jpg',
  'STK-003': 'bottle.jpg',
  'STK-004': 'notebook.jpg',
  'STK-005': 'keyboard.jpg',
  'STK-006': 'tote-bag.jpg',
  'STK-007': 'speaker.jpg',
  'STK-008': 'mouse.jpg',
};
export function getProductImages(product: Product) {
  return (
    product.imageUrls ??
    (productPhotos[product.sku] ? [`/images/products/${productPhotos[product.sku]}`] : [])
  );
}
export function ProductArt({ product, imageUrl }: { product: Product; imageUrl?: string }) {
  const photo = imageUrl || getProductImages(product)[0];
  if (photo) {
    return (
      <div className="product-art product-photo">
        <img src={imagePreview(photo)} alt={product.name} loading="lazy" />
      </div>
    );
  }
  const name = product.name.toLowerCase();
  const kind = name.includes('headphone')
    ? 'headphones'
    : name.includes('lamp')
      ? 'lamp'
      : name.includes('bottle')
        ? 'bottle'
        : name.includes('notebook')
          ? 'notebook'
          : name.includes('keyboard')
            ? 'keyboard'
            : name.includes('bag') || name.includes('tote')
              ? 'bag'
              : name.includes('speaker')
                ? 'speaker'
                : name.includes('mouse')
                  ? 'mouse'
                  : 'box';
  return (
    <div className={`product-art art-${kind}`} aria-hidden="true">
      <div className={`object ${kind}`}>
        <i />
      </div>
      <span className="art-shadow" />
    </div>
  );
}
export function ProductCardImage({ product }: { product: Product }) {
  const images = getProductImages(product);
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const imageKey = images.join('|');
  useEffect(() => setSelected(0), [imageKey]);
  useEffect(() => {
    if (
      images.length < 2 ||
      hovered ||
      focused ||
      paused ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const timer = setInterval(() => {
      if (!document.hidden) setSelected((index) => (index + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images.length, hovered, focused, paused]);
  const current = selected < images.length ? selected : 0;
  if (images.length < 2)
    return (
      <Link to={`/products/${product.id}`} className="product-image">
        <ProductArt product={product} />
        <span className="product-category">{product.category}</span>
      </Link>
    );
  return (
    <div
      className="product-image product-carousel"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${product.name} images`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <Link
        to={`/products/${product.id}`}
        aria-label={`View ${product.name}, image ${current + 1} of ${images.length}`}
      >
        <ProductArt product={product} imageUrl={images[current]} />
        <span className="product-category">{product.category}</span>
      </Link>
      <button
        type="button"
        className="carousel-toggle"
        aria-label={paused ? `Play ${product.name} slideshow` : `Pause ${product.name} slideshow`}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <Play size={12} /> : <Pause size={12} />}
      </button>
      <button
        type="button"
        className="carousel-arrow previous"
        aria-label={`Previous image of ${product.name}`}
        onClick={() => setSelected((current - 1 + images.length) % images.length)}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        className="carousel-arrow next"
        aria-label={`Next image of ${product.name}`}
        onClick={() => setSelected((current + 1) % images.length)}
      >
        <ChevronRight size={18} />
      </button>
      <div className="carousel-dots" aria-label="Choose product image">
        {images.map((url, index) => (
          <button
            type="button"
            key={url}
            aria-label={`Show image ${index + 1} of ${product.name}`}
            aria-pressed={current === index}
            className={current === index ? 'selected' : ''}
            onClick={() => setSelected(index)}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}
export function ProductGallery({ product }: { product: Product }) {
  const [selected, setSelected] = useState(0);
  const images = getProductImages(product);
  useEffect(() => setSelected(0), [product.id]);
  return (
    <div className="product-gallery">
      <ProductArt product={product} imageUrl={images[selected] || images[0]} />
      {images.length > 1 && (
        <div className="gallery-thumbnails" aria-label="Product images">
          {images.map((url, index) => (
            <button
              type="button"
              key={url}
              className={selected === index ? 'selected' : ''}
              aria-label={`View product image ${index + 1}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <img src={imagePreview(url)} alt={`${product.name}, view ${index + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
