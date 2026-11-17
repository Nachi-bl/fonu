import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Box,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CreditCard,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Truck,
  Upload,
  ImagePlus,
  X,
} from 'lucide-react';
import {
  api,
  money,
  setToken,
  uploadProductImages,
  imagePreview,
  type Order,
  type Page,
  type Product,
  type User,
} from './api';
import {
  ProductArt,
  ProductCardImage,
  ProductGallery,
  getProductImages,
} from './components/product-images';
import './styles.scss';
type CartItem = { product: Product; quantity: number };
type Context = {
  user: User | null;
  session: (data: { user: User; accessToken: string } | null) => void;
  cart: CartItem[];
  update: (product: Product, quantity: number) => void;
  clear: () => void;
  notify: (text: string) => void;
};
const AppContext = createContext<Context>(null!);
const useApp = () => useContext(AppContext);
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } });
function Provider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('stockroom-cart') || '[]');
      return Array.isArray(saved)
        ? saved.filter(
            (x: CartItem) => x.product?.id && Number.isInteger(x.quantity) && x.quantity > 0,
          )
        : [];
    } catch {
      return [];
    }
  });
  const [toast, notify] = useState('');
  useEffect(() => {
    localStorage.setItem('stockroom-cart', JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => notify(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  function session(data: { user: User; accessToken: string } | null) {
    setToken(data?.accessToken || '');
    setUser(data?.user || null);
    client.clear();
  }
  function update(product: Product, quantity: number) {
    setCart((items) => [
      ...items.filter((x) => x.product.id !== product.id),
      ...(quantity > 0
        ? [{ product, quantity: Math.min(quantity, product.stockQuantity) }].filter(
            (x) => x.quantity > 0,
          )
        : []),
    ]);
  }
  return (
    <AppContext.Provider value={{ user, session, cart, update, clear: () => setCart([]), notify }}>
      {children}
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => notify('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
function Shell() {
  const { user, session, cart } = useApp();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = React.useRef<HTMLButtonElement>(null);
  useEffect(() => setMenuOpen(false), [location.key]);
  const admin = location.pathname.startsWith('/admin');
  return (
    <div className="shell">
      <aside
        className={`sidebar${menuOpen ? ' menu-open' : ''}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && menuOpen) {
            setMenuOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <Link to="/" className="brand">
          stockroom<span className="brand-dot">.</span>
        </Link>
        <button
          ref={menuButton}
          className="mobile-menu-toggle"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="workspace-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            Stockroom workspace<small>Inventory & orders</small>
          </div>
          <span className="workspace-chevron">⌄</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav id="workspace-navigation" aria-label="Workspace navigation">
          <NavLink to="/" end>
            <LayoutGrid size={19} />
            Browse products
          </NavLink>
          <NavLink to="/cart">
            <ShoppingBag size={19} />
            My cart<span className="nav-count">{cart.reduce((n, x) => n + x.quantity, 0)}</span>
          </NavLink>
          <NavLink to="/orders">
            <ClipboardList size={19} />
            My orders
          </NavLink>
          {user?.role === 'ADMIN' && (
            <>
              <p className="nav-label">MANAGEMENT</p>
              <NavLink to="/admin/products">
                <Boxes size={19} />
                Inventory
              </NavLink>
              <NavLink to="/admin/orders">
                <Truck size={19} />
                Incoming orders
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <CircleHelp size={21} />
            <strong>A little more organized.</strong>
            <p>Everything you need to keep your business moving.</p>
          </div>
          {user ? (
            <div className="profile">
              <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{user.name}</strong>
                <small>{user.role.toLowerCase()} account</small>
              </div>
              <button title="Sign out" aria-label="Sign out" onClick={() => session(null)}>
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link className="button sidebar-signin" to="/login">
              Sign in to your account
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>
              {admin
                ? 'Management'
                : location.pathname === '/cart'
                  ? 'My cart'
                  : location.pathname.includes('orders')
                    ? 'Orders'
                    : 'Product catalog'}
            </strong>
          </div>
          <div className="top-actions">
            <span className="live-dot" />
            All systems operational
            <span className="divider" />
            <Link className="icon-button" aria-label="Open cart" to="/cart">
              <ShoppingCart size={20} />
              <span>{cart.length}</span>
            </Link>
            {user ? (
              <span className="avatar small">{user.name.slice(0, 2).toUpperCase()}</span>
            ) : (
              <Link to="/login" className="text-link">
                Sign in <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage register />} />
            <Route path="/cart" element={<Cart />} />
            <Route
              path="/orders"
              element={
                <Protected>
                  <Orders />
                </Protected>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <Protected>
                  <OrderDetail />
                </Protected>
              }
            />
            <Route
              path="/admin/products"
              element={
                <Protected admin>
                  <Inventory />
                </Protected>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <Protected admin>
                  <Orders admin />
                </Protected>
              }
            />
            <Route
              path="/403"
              element={
                <Empty title="Access restricted" text="This page is available to administrators." />
              }
            />
            <Route
              path="*"
              element={
                <Empty title="Page not found" text="The page you are looking for does not exist." />
              }
            />
          </Routes>
        </main>
        <footer>
          <span>© {new Date().getFullYear()} Stockroom. A place for everything.</span>
          <span>Made for the way you work.</span>
        </footer>
      </div>
    </div>
  );
}
function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/403" replace />;
  return children;
}
function Heading({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{text}</p>
      </div>
      {children}
    </div>
  );
}
function ErrorBox({ error, retry }: { error: Error | null; retry?: () => void }) {
  return error ? (
    <div className="error" role="alert">
      {error.message}
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  ) : null;
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Package size={38} />
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="button secondary" to="/">
        Browse products
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
function Loading() {
  return (
    <div aria-label="Loading" className="skeleton-grid">
      {[1, 2, 3, 4, 5, 6].map((x) => (
        <div className="skeleton" key={x} />
      ))}
    </div>
  );
}
function Pagination({
  page,
  total,
  limit,
  setPage,
}: {
  page: number;
  total: number;
  limit: number;
  setPage: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}` : '0'}{' '}
        results
      </span>
      <div>
        <button aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / limit))}
        </span>
        <button
          aria-label="Next page"
          disabled={page * limit >= total}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
const categories = ['All products', 'Workspace', 'Electronics', 'Everyday', 'Accessories'];
function Stock({ product }: { product: Product }) {
  return (
    <span
      className={`badge ${!product.isActive || product.stockQuantity === 0 ? 'neutral' : product.stockQuantity < 10 ? 'warning' : 'success'}`}
    >
      <span />
      {!product.isActive
        ? 'Archived'
        : product.stockQuantity === 0
          ? 'Out of stock'
          : product.stockQuantity < 10
            ? `Only ${product.stockQuantity} left`
            : 'In stock'}
    </span>
  );
}
function Catalog() {
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState('All products'),
    [page, setPage] = useState(1);
  const { cart, update, notify } = useApp();
  const query = useQuery({
    queryKey: ['products', search, category, page],
    queryFn: () =>
      api<Page<Product>>(
        `/products?limit=8&page=${page}&search=${encodeURIComponent(search)}${category === 'All products' ? '' : `&category=${category}`}`,
      ),
  });
  return (
    <>
      <Heading
        eyebrow="THE STOCKROOM COLLECTION"
        title="Good things. In stock."
        text="Thoughtful essentials for your workspace and everyday life."
      >
        <Link className="button secondary" to="/orders">
          <ClipboardList size={17} />
          View my orders
        </Link>
      </Heading>
      <section className="catalog-banner">
        <div>
          <span className="banner-label">
            <span />
            CURATED FOR YOUR EVERYDAY
          </span>
          <h2>
            A better day starts
            <br />
            with the right essentials.
          </h2>
          <p>Discover useful things, made to make a difference.</p>
          <a href="#collection">
            Explore the collection <ArrowRight size={16} />
          </a>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="banner-ring" />
          <div className="banner-plinth" />
          <div className="banner-bottle" />
          <div className="banner-book" />
          <div className="banner-ball" />
          <span className="banner-spark">✦</span>
        </div>
        <span className="banner-edition">THE EVERYDAY EDIT / 01</span>
      </section>
      <section id="collection" className="collection">
        <div className="section-title">
          <div>
            <h2>
              Explore the collection <span>{query.data?.total ?? '—'}</span>
            </h2>
            <p>A little utility. A lot of possibility.</p>
          </div>
          <span className="curated-note">
            <ShieldCheck size={16} />
            Quality in every detail
          </span>
        </div>
        <div className="catalog-controls">
          <div className="tabs">
            {categories.map((c) => (
              <button
                className={category === c ? 'selected' : ''}
                onClick={() => {
                  setCategory(c);
                  setPage(1);
                }}
                key={c}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search products"
              placeholder="Search products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="results-label">
          <span>
            {query.data?.total ?? 0} products{category !== 'All products' ? ` in ${category}` : ''}
          </span>
          <span>
            <SlidersHorizontal size={14} />
            Recently added
            <ArrowDown size={13} />
          </span>
        </div>
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
        {query.isPending ? (
          <Loading />
        ) : query.data?.data.length === 0 ? (
          <Empty title="No products found" text="Try a different search or category." />
        ) : (
          <div className="product-grid">
            {query.data?.data.map((p) => (
              <article className="product-card" key={p.id}>
                <ProductCardImage product={p} />
                <div className="product-info">
                  <div className="product-title">
                    <Link to={`/products/${p.id}`}>
                      <h3>{p.name}</h3>
                    </Link>
                    <span>{money(p.priceMinor)}</span>
                  </div>
                  <p>{p.description}</p>
                  <div className="product-bottom">
                    <Stock product={p} />
                    <button
                      className="add-button"
                      disabled={
                        !p.stockQuantity ||
                        (cart.find((x) => x.product.id === p.id)?.quantity || 0) >= p.stockQuantity
                      }
                      aria-label={`Add ${p.name} to cart`}
                      onClick={() => {
                        update(p, (cart.find((x) => x.product.id === p.id)?.quantity || 0) + 1);
                        notify(`${p.name} added to your cart`);
                      }}
                    >
                      <Plus size={17} />
                      <span>Add to cart</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {query.data && (
          <Pagination page={page} total={query.data.total} limit={8} setPage={setPage} />
        )}
      </section>
      <div className="assurance">
        <span>
          <Box size={19} />
          <div>
            <strong>Considered essentials</strong>
            <small>Useful by design, everyday.</small>
          </div>
        </span>
        <span>
          <ShieldCheck size={19} />
          <div>
            <strong>Shop with confidence</strong>
            <small>Live stock. Transparent pricing.</small>
          </div>
        </span>
        <span>
          <ClipboardList size={19} />
          <div>
            <strong>Everything in one place</strong>
            <small>Easy ordering, effortless tracking.</small>
          </div>
        </span>
      </div>
    </>
  );
}
function ProductDetail() {
  const { id } = useParams();
  const { cart, update, notify } = useApp();
  const [quantity, setQuantity] = useState(1);
  const q = useQuery({ queryKey: ['product', id], queryFn: () => api<Product>(`/products/${id}`) });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const p = q.data!;
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Back to collection
      </Link>
      <div className="product-detail">
        <ProductGallery product={p} />
        <div>
          <p className="eyebrow">
            {p.category} / {p.sku}
          </p>
          <h1>{p.name}</h1>
          <p className="detail-price">{money(p.priceMinor)}</p>
          <Stock product={p} />
          <p className="detail-description">{p.description}</p>
          <p className="muted">{p.stockQuantity} available · Stock is confirmed at checkout.</p>
          <label>
            Quantity
            <input
              type="number"
              min={1}
              max={Math.max(1, p.stockQuantity)}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <button
            className="button"
            disabled={
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity + (cart.find((x) => x.product.id === p.id)?.quantity || 0) > p.stockQuantity
            }
            onClick={() => {
              update(p, quantity + (cart.find((x) => x.product.id === p.id)?.quantity || 0));
              notify('Added to your cart');
            }}
          >
            <ShoppingBag size={17} />
            Add to cart
          </button>
        </div>
      </div>
    </>
  );
}
function AuthPage({ register = false }: { register?: boolean }) {
  const { session } = useApp();
  const navigate = useNavigate(),
    location = useLocation();
  const mutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api<{ user: User; accessToken: string }>(
        `/auth/${register ? 'register' : 'login'}`,
        'POST',
        data,
      ),
    onSuccess: (data) => {
      session(data);
      navigate(location.state?.from || (data.user.role === 'ADMIN' ? '/admin/products' : '/'));
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>);
  }
  return (
    <div className="auth-layout">
      <div className="auth-intro">
        <p className="eyebrow">WELCOME TO STOCKROOM</p>
        <h1>
          Less managing.
          <br />
          More moving forward.
        </h1>
        <p>
          Your essentials, inventory, and orders.
          <br />
          All in one thoughtful workspace.
        </p>
        <div className="auth-decoration">
          <Package size={110} strokeWidth={0.8} />
        </div>
      </div>
      <form className="auth-form panel" onSubmit={submit}>
        <p className="eyebrow">YOUR WORKSPACE AWAITS</p>
        <h2>{register ? 'Create your account' : 'Welcome back'}</h2>
        <p className="muted">
          {register
            ? 'A few details and you’re ready to go.'
            : 'Sign in to pick up where you left off.'}
        </p>
        {register && (
          <label>
            Full name
            <input
              name="name"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
              placeholder="Your name"
            />
          </label>
        )}
        <label>
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={10}
            maxLength={72}
            required
            placeholder="At least 10 characters"
          />
        </label>
        <ErrorBox error={mutation.error} />
        <button className="button" disabled={mutation.isPending}>
          {mutation.isPending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
          <ArrowRight size={17} />
        </button>
        <p className="auth-switch">
          {register ? 'Already have an account?' : 'New to Stockroom?'}{' '}
          <Link to={register ? '/login' : '/register'}>
            {register ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
        <small className="muted">
          Your session stays in memory. Sign in again after refreshing.
        </small>
      </form>
    </div>
  );
}
function Cart() {
  const { cart, update, clear, user } = useApp();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api<Order>('/orders', 'POST', {
        items: cart.map((x) => ({ productId: x.product.id, quantity: x.quantity })),
      }),
    onSuccess: (o) => {
      clear();
      void qc.invalidateQueries();
      navigate(`/orders/${o.id}`, { state: { placed: true } });
    },
  });
  return (
    <>
      <Heading
        eyebrow="YOUR SELECTION"
        title="My cart"
        text="A few good things, ready for your everyday."
      />
      {!cart.length ? (
        <Empty title="Your cart is waiting" text="Find something useful in the collection." />
      ) : (
        <div className="cart-layout">
          <div className="panel cart-items">
            {cart.map(({ product: p, quantity }) => (
              <div className="cart-row" key={p.id}>
                <ProductArt product={p} />
                <div>
                  <Link to={`/products/${p.id}`}>
                    <h3>{p.name}</h3>
                  </Link>
                  <small>{money(p.priceMinor)} each</small>
                  <label className="quantity-label">
                    Quantity
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={quantity}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n > 0) update(p, n);
                      }}
                    />
                  </label>
                </div>
                <strong>{money(p.priceMinor * quantity)}</strong>
                <button aria-label={`Remove ${p.name}`} onClick={() => update(p, 0)}>
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
          <aside className="panel order-summary">
            <h2>Order summary</h2>
            <div>
              <span>Items ({cart.reduce((n, x) => n + x.quantity, 0)})</span>
              <strong>
                {money(cart.reduce((n, x) => n + x.product.priceMinor * x.quantity, 0))}
              </strong>
            </div>
            <div className="summary-total">
              <span>Estimated total</span>
              <strong>
                {money(cart.reduce((n, x) => n + x.product.priceMinor * x.quantity, 0))}
              </strong>
            </div>
            <p className="muted">
              Final prices and availability are verified when you place your order.
            </p>
            <ErrorBox error={mutation.error} />
            <label className="payment-method">
              <input type="radio" name="payment-method" value="paystack" checked readOnly />
              <CreditCard size={22} />
              <span>
                <strong>Paystack</strong>
                <small>Pay securely after placing your order</small>
              </span>
            </label>
            {user?.role === 'ADMIN' ? (
              <p className="error">Use a customer account to place an order.</p>
            ) : (
              <button
                className="button"
                disabled={mutation.isPending}
                onClick={() =>
                  user ? mutation.mutate() : navigate('/login', { state: { from: '/cart' } })
                }
              >
                {mutation.isPending
                  ? 'Placing order…'
                  : user
                    ? 'Place order'
                    : 'Sign in to checkout'}
                <ArrowRight size={16} />
              </button>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`badge ${status === 'CONFIRMED' ? 'success' : status === 'PENDING' ? 'warning' : 'neutral'}`}
    >
      <span />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
function Orders({ admin = false }: { admin?: boolean }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['orders', page],
    queryFn: () => api<Page<Order>>(`/orders?page=${page}&limit=10`),
  });
  return (
    <>
      <Heading
        eyebrow={admin ? 'MANAGEMENT' : 'YOUR WORKSPACE'}
        title={admin ? 'Incoming orders' : 'My orders'}
        text={
          admin
            ? 'Every order, every detail. Keep things moving.'
            : 'Keep an eye on your orders, all in one place.'
        }
      />
      <ErrorBox error={q.error} retry={() => void q.refetch()} />
      {q.isPending ? (
        <Loading />
      ) : !q.data?.data.length ? (
        <Empty
          title="No orders yet"
          text={
            admin
              ? 'New customer orders will appear here.'
              : 'Your next good find is just around the corner.'
          }
        />
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                {admin && <th>Customer</th>}
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link className="text-link" to={`/orders/${o.id}`}>
                      #{o.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  {admin && (
                    <td>
                      {o.user.name}
                      <small>{o.user.email}</small>
                    </td>
                  )}
                  <td>{new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
                  <td>{o.items.reduce((n, x) => n + x.quantity, 0)}</td>
                  <td>
                    <strong>{money(o.totalMinor)}</strong>
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td>
                    <Link aria-label="View order" to={`/orders/${o.id}`}>
                      <ArrowRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={q.data.total} limit={10} setPage={setPage} />
        </div>
      )}
    </>
  );
}
function OrderPayment({ order }: { order: Order }) {
  const { user, notify } = useApp();
  const location = useLocation();
  const qc = useQueryClient();
  const checkedReturn = React.useRef(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const start = useMutation({
    mutationFn: () =>
      api<{ authorizationUrl?: string; paid?: boolean }>(`/orders/${order.id}/payment`, 'POST'),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['order', order.id] });
      if (result.paid) notify('Order payment completed');
      else if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
    },
  });
  const verify = useMutation({
    mutationFn: () =>
      api<{ paid: boolean; providerStatus?: string }>(`/orders/${order.id}/payment/verify`, 'POST'),
    onSuccess: (result) => {
      void qc.invalidateQueries();
      setPaymentMessage(
        result.paid
          ? 'Payment verified. Thank you!'
          : 'Payment is not complete yet. You can return to Paystack to finish or check again.',
      );
    },
  });
  useEffect(() => {
    if (
      new URLSearchParams(location.search).get('payment') === 'return' &&
      user?.role === 'CUSTOMER' &&
      order.paymentStatus !== 'PAID' &&
      !checkedReturn.current
    ) {
      checkedReturn.current = true;
      verify.mutate();
    }
  }, [location.search, order.paymentStatus, user?.role]);
  if (order.status === 'CANCELLED') return null;
  const paid = order.paymentStatus === 'PAID';
  return (
    <section className="panel payment-panel" aria-labelledby="payment-title">
      <div className="payment-panel-heading">
        <span className="payment-icon">
          <CreditCard size={24} />
        </span>
        <div>
          <h2 id="payment-title">{paid ? 'Payment received' : 'Complete your payment'}</h2>
          <p>
            {paid
              ? 'Your Paystack payment has been verified.'
              : 'Pay securely with Paystack. Your order total is shown below.'}
          </p>
        </div>
        <span className={`badge ${paid ? 'success' : 'warning'}`}>
          <span />
          {paid ? 'Paid' : order.paymentStatus === 'PROCESSING' ? 'Awaiting payment' : 'Unpaid'}
        </span>
      </div>
      {!paid && (
        <>
          <label className="payment-method">
            <input type="radio" name="order-payment-method" value="paystack" checked readOnly />
            <CreditCard size={22} />
            <span>
              <strong>Paystack</strong>
              <small>Choose your payment option on Paystack’s secure checkout.</small>
            </span>
            <ShieldCheck size={18} />
          </label>
          <div className="payment-total">
            <span>Amount to pay</span>
            <strong>{money(order.totalMinor)}</strong>
          </div>
          {user?.role === 'CUSTOMER' ? (
            <div className="payment-buttons">
              <button
                className="button"
                disabled={start.isPending || verify.isPending}
                onClick={() => start.mutate()}
              >
                <CreditCard size={17} />
                {start.isPending
                  ? 'Opening Paystack…'
                  : order.paymentStatus === 'PROCESSING'
                    ? 'Continue payment'
                    : `Pay ${money(order.totalMinor)} with Paystack`}
              </button>
              {order.paymentReference && (
                <button
                  className="button secondary"
                  disabled={start.isPending || verify.isPending}
                  onClick={() => verify.mutate()}
                >
                  {verify.isPending ? 'Verifying payment…' : 'I have paid — check status'}
                </button>
              )}
            </div>
          ) : (
            <p className="muted">The customer can complete this payment from their order page.</p>
          )}
          <p className="payment-note">
            Payment details are entered on Paystack. This store does not collect your card details.
          </p>
        </>
      )}
      {paid && order.paidAt && (
        <p className="muted">Paid {new Date(order.paidAt).toLocaleString('en-GB')}</p>
      )}
      {paymentMessage && (
        <p role="status" className="muted">
          {paymentMessage}
        </p>
      )}
      <ErrorBox error={start.error || verify.error} />
    </section>
  );
}
function OrderDetail() {
  const { id } = useParams();
  const { user, notify } = useApp();
  const location = useLocation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api<Order>(`/orders/${id}`) });
  const mutation = useMutation({
    mutationFn: (status: string) =>
      status === 'CANCELLED'
        ? api(`/orders/${id}`, 'DELETE')
        : api(`/orders/${id}/status`, 'PATCH', { status }),
    onSuccess: () => {
      void qc.invalidateQueries();
      notify('Order updated');
    },
  });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const o = q.data!;
  return (
    <>
      <Link className="back-link" to={user?.role === 'ADMIN' ? '/admin/orders' : '/orders'}>
        <ArrowLeft size={16} />
        Back to orders
      </Link>
      {location.state?.placed && (
        <div className="success-banner">
          <Check size={20} />
          Your order is placed. We’ve got it from here.
        </div>
      )}
      <Heading
        eyebrow="ORDER DETAILS"
        title={`Order #${o.id.slice(0, 8).toUpperCase()}`}
        text={`Placed ${new Date(o.createdAt).toLocaleString('en-GB')} · ${o.user.name}`}
      >
        <StatusBadge status={o.status} />
      </Heading>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Unit price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((x) => (
              <tr key={x.id}>
                <td>{x.productNameSnapshot}</td>
                <td>{x.quantity}</td>
                <td>{money(x.unitPriceMinor)}</td>
                <td>{money(x.lineTotalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="order-total">
          Order total <strong>{money(o.totalMinor)}</strong>
        </div>
      </div>
      <OrderPayment order={o} />
      <ErrorBox error={mutation.error} />
      {o.status === 'PENDING' && (
        <div className="order-actions">
          {user?.role === 'ADMIN' && (
            <button
              className="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate('CONFIRMED')}
            >
              <Check size={17} />
              Confirm order
            </button>
          )}
          {o.paymentStatus !== 'PROCESSING' && o.paymentStatus !== 'PAID' && (
            <button
              className="button secondary danger-text"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate('CANCELLED')}
            >
              Cancel order
            </button>
          )}
        </div>
      )}
    </>
  );
}
function Inventory() {
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<Product | null | undefined>();
  const qc = useQueryClient();
  const { notify } = useApp();
  const q = useQuery({
    queryKey: ['inventory', search, page],
    queryFn: () =>
      api<Page<Product>>(
        `/products/inventory?limit=10&page=${page}&search=${encodeURIComponent(search)}`,
      ),
  });
  const archive = useMutation({
    mutationFn: (p: Product) =>
      api(
        `/products/${p.id}`,
        p.isActive ? 'DELETE' : 'PATCH',
        p.isActive ? undefined : { isActive: true },
      ),
    onSuccess: () => {
      void qc.invalidateQueries();
      notify('Product updated');
    },
  });
  return (
    <>
      <Heading
        eyebrow="MANAGEMENT"
        title="Inventory"
        text="A clear view of your products. Everything in its place."
      >
        <button className="button" onClick={() => setEditing(null)}>
          <Plus size={17} />
          Add product
        </button>
      </Heading>
      <div className="admin-stats">
        <div className="panel">
          <Boxes size={21} />
          <span>
            Total products<strong>{q.data?.total ?? '—'}</strong>
          </span>
        </div>
        <div className="panel">
          <ShieldCheck size={21} />
          <span>
            Inventory control<strong>Always up to date</strong>
          </span>
        </div>
        <div className="panel">
          <Truck size={21} />
          <span>
            Ready for the next step
            <Link to="/admin/orders">
              View incoming orders <ArrowRight size={15} />
            </Link>
          </span>
        </div>
      </div>
      <div className="panel table-wrap">
        <div className="table-toolbar">
          <h2>All products</h2>
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search inventory"
              placeholder="Search name or SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <ErrorBox error={q.error || archive.error} retry={() => void q.refetch()} />
        {q.isPending ? (
          <Loading />
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product">
                        <ProductArt product={p} />
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.category}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code>{p.sku}</code>
                    </td>
                    <td>{money(p.priceMinor)}</td>
                    <td>{p.stockQuantity}</td>
                    <td>
                      <Stock product={p} />
                    </td>
                    <td>{new Date(p.updatedAt).toLocaleDateString('en-GB')}</td>
                    <td>
                      <div className="row-actions">
                        <button onClick={() => setEditing(p)}>Edit</button>
                        <button disabled={archive.isPending} onClick={() => archive.mutate(p)}>
                          {p.isActive ? 'Archive' : 'Restore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {q.data?.total === 0 && (
              <Empty title="No products yet" text="Add your first product to get started." />
            )}
            {q.data && <Pagination page={page} total={q.data.total} limit={10} setPage={setPage} />}
          </>
        )}
      </div>
      {editing !== undefined && (
        <ProductForm product={editing} close={() => setEditing(undefined)} />
      )}
    </>
  );
}
function ProductForm({ product, close }: { product: Product | null; close: () => void }) {
  const qc = useQueryClient();
  const { notify } = useApp();
  const formRef = React.useRef<HTMLFormElement>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const objectUrls = React.useRef(new Set<string>());
  const [images, setImages] = useState<
    { url?: string; file?: File; preview: string; name: string }[]
  >(() =>
    product
      ? getProductImages(product).map((url, index) => ({
          url,
          preview: imagePreview(url),
          name: `Product image ${index + 1}`,
        }))
      : [],
  );
  const [imageError, setImageError] = useState<Error | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  function chooseImages(files: FileList | null) {
    if (!files?.length) return;
    setImageError(null);
    const selected = Array.from(files);
    if (selected.length + images.length > 7) {
      setImageError(
        new Error('A product can have at most 7 images. Remove an image or choose fewer files.'),
      );
      return;
    }
    if (selected.some((file) => file.size === 0 || file.size > 10 * 1024 * 1024)) {
      setImageError(new Error('Each image must be non-empty and no larger than 10 MB.'));
      return;
    }
    if (
      selected.some(
        (file) =>
          file.type && !file.type.startsWith('image/') && file.type !== 'application/octet-stream',
      )
    ) {
      setImageError(new Error('Please choose image files only.'));
      return;
    }
    setImages((current) => [
      ...current,
      ...selected.map((file) => {
        const preview = URL.createObjectURL(file);
        objectUrls.current.add(preview);
        return { file, preview, name: file.name };
      }),
    ]);
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    formRef.current?.querySelector<HTMLInputElement>('input:not([hidden])')?.focus();
    return () => previous?.focus();
  }, []);
  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      let savedImages = images;
      const files = images.flatMap((image) => (image.file ? [image.file] : []));
      if (files.length) {
        setUploading(true);
        try {
          const result = await uploadProductImages(files, (index, url) => {
            setImages((current) =>
              current.map((image) =>
                image.file === files[index]
                  ? { url, preview: image.preview, name: image.name }
                  : image,
              ),
            );
          });
          let next = 0;
          savedImages = images.map((image) =>
            image.file
              ? { url: result.urls[next++], preview: image.preview, name: image.name }
              : image,
          );
          setImages(savedImages);
        } finally {
          setUploading(false);
        }
      }
      return api(product ? `/products/${product.id}` : '/products', product ? 'PATCH' : 'POST', {
        ...body,
        imageUrls: savedImages.map((image) => image.url!),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      notify(product ? 'Product saved' : 'Product created');
      close();
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    mutation.mutate({
      ...data,
      priceMinor: Math.round(Number(data.priceMinor) * 100),
      stockQuantity: Number(data.stockQuantity),
    });
  }
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !mutation.isPending) close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !mutation.isPending) close();
        if (e.key === 'Tab') {
          const fields = formRef.current?.querySelectorAll<HTMLElement>(
            'input:not([hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
          );
          if (!fields?.length) return;
          const first = fields[0],
            last = fields[fields.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <form
        ref={formRef}
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        onSubmit={submit}
      >
        <div className="modal-title">
          <h2 id="product-form-title">{product ? 'Edit product' : 'Add a product'}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={close}
            disabled={mutation.isPending}
          >
            <X size={20} />
          </button>
        </div>
        <section className="image-uploader" aria-labelledby="product-images-label">
          <div className="image-upload-heading">
            <h3 id="product-images-label">Product images</h3>
            <span>{images.length} / 7</span>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,.heic,.heif,.tif,.tiff,.jxl,.psd,.raw,.dng"
            multiple
            hidden
            disabled={mutation.isPending}
            onChange={(event) => {
              chooseImages(event.target.files);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            className="image-upload-trigger"
            disabled={images.length >= 7 || mutation.isPending}
            onClick={() => fileInput.current?.click()}
          >
            <span className="upload-icon">
              <Upload size={23} />
            </span>
            <strong>
              {images.length >= 7 ? 'Seven images selected' : 'Click to upload product images'}
            </strong>
            <span>All image formats · Up to 7 images · 10 MB per image</span>
          </button>
          <p className="image-upload-help">
            The first image is your cover. Images upload when you save the product.
          </p>
          {images.length > 0 && (
            <div className="image-preview-grid">
              {images.map((image, index) => (
                <div className="image-preview-card" key={image.preview}>
                  <div className="image-preview-picture">
                    <ImagePlus size={26} aria-hidden="true" />
                    <img
                      src={image.preview}
                      alt={image.name}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                    {index === 0 && <span className="cover-badge">Cover</span>}
                    <button
                      type="button"
                      className="remove-image"
                      aria-label={`Remove image ${index + 1}`}
                      disabled={mutation.isPending}
                      onClick={() => {
                        setImages((current) => current.filter((_, i) => i !== index));
                        setImageError(null);
                        if (objectUrls.current.has(image.preview)) {
                          URL.revokeObjectURL(image.preview);
                          objectUrls.current.delete(image.preview);
                        }
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <span className="image-file-name" title={image.name}>
                    {image.name}
                  </span>
                  {index > 0 && (
                    <button
                      type="button"
                      className="make-cover"
                      disabled={mutation.isPending}
                      onClick={() =>
                        setImages((current) => [
                          current[index],
                          ...current.filter((_, i) => i !== index),
                        ])
                      }
                    >
                      Make cover
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <ErrorBox error={imageError} />
        </section>
        <label>
          Product name
          <input name="name" minLength={2} maxLength={120} defaultValue={product?.name} required />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={2000}
            defaultValue={product?.description}
            required
          />
        </label>
        <div className="form-grid">
          <label>
            SKU
            <input name="sku" maxLength={50} defaultValue={product?.sku} required />
          </label>
          <label>
            Category
            <select name="category" defaultValue={product?.category || 'Workspace'}>
              {categories.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Price (NGN)
            <input
              type="number"
              step="0.01"
              min="0"
              max="1000000"
              name="priceMinor"
              defaultValue={product ? product.priceMinor / 100 : undefined}
              required
            />
          </label>
          <label>
            Stock quantity
            <input
              type="number"
              min="0"
              max="1000000"
              step="1"
              name="stockQuantity"
              defaultValue={product?.stockQuantity ?? 0}
              required
            />
          </label>
        </div>
        <ErrorBox error={mutation.error} />
        <div className="modal-actions">
          <button
            className="button secondary"
            type="button"
            onClick={close}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button className="button" disabled={mutation.isPending}>
            {uploading ? 'Uploading images…' : mutation.isPending ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
    </div>
  );
}
class ErrorBoundary extends React.Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty">
        <h1>Something went wrong</h1>
        <p>Please reload the page to try again.</p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <Provider>
            <Shell />
          </Provider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
