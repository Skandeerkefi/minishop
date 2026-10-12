import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function App() {
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [isOrdering, setIsOrdering] = useState(false)
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('minishop_session')) } catch { return null }
  })
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', stock: '' })

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  async function loadProducts() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/products`)
      if (!response.ok) throw new Error('The product service could not be reached.')
      setProducts(await response.json())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadOrders() {
    setOrdersLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/orders`)
      if (!response.ok) throw new Error('The order service could not be reached.')
      setOrders(await response.json())
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [])
  useEffect(() => { loadOrders() }, [])

  function addToCart(product) {
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.productId === product._id)
      if (existing) return currentCart.map((item) => item.productId === product._id ? { ...item, quantity: item.quantity + 1 } : item)
      return [...currentCart, { productId: product._id, name: product.name, price: product.price, quantity: 1 }]
    })
    setNotice(`${product.name} added to your basket.`)
    setIsCartOpen(true)
  }

  function changeQuantity(productId, amount) {
    setCart((currentCart) => currentCart.map((item) => item.productId === productId ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0))
  }

  async function submitOrder(event) {
    event.preventDefault()
    if (cart.length === 0) return
    if (!session) { setAuthMode('login'); setIsAuthOpen(true); setNotice('Sign in before placing an order.'); return }
    setIsOrdering(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ items: cart.map(({ productId, quantity }) => ({ productId, quantity })) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The order could not be created.')
      setCart([])
      setIsCartOpen(false)
      await loadOrders()
      setNotice(`Order ${result._id.slice(-6).toUpperCase()} confirmed for ${formatPrice(result.total)}.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsOrdering(false)
    }
  }

  async function submitProduct(event) {
    event.preventDefault()
    if (session?.user.role !== 'ADMIN') { setAuthMode('login'); setIsAuthOpen(true); setNotice('Admin access is required to publish products.'); return }
    setIsAddingProduct(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ name: productForm.name, description: productForm.description, price: Number(productForm.price), stock: Number(productForm.stock) }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The product could not be created.')
      setProducts((currentProducts) => [result, ...currentProducts])
      setProductForm({ name: '', description: '', price: '', stock: '' })
      setNotice(`${result.name} is now live in the catalog.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsAddingProduct(false)
    }
  }

  async function submitAuth(event) {
    event.preventDefault()
    setError('')
    try {
      const response = await fetch(`${API_URL}/api/auth/${authMode === 'login' ? 'login' : 'register'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authMode === 'login' ? { email: authForm.email, password: authForm.password } : authForm) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Authentication failed.')
      const nextSession = { token: result.token, user: result.user }
      localStorage.setItem('minishop_session', JSON.stringify(nextSession))
      setSession(nextSession)
      setAuthForm({ name: '', email: '', password: '' })
      setIsAuthOpen(false)
      setNotice(`Welcome, ${result.user.name}.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function signOut() {
    localStorage.removeItem('minishop_session')
    setSession(null)
    setNotice('You have been signed out.')
  }

  const featuredProduct = products[0]
  const catalogLabel = useMemo(() => `${products.length} ${products.length === 1 ? 'piece' : 'pieces'} in the catalog`, [products.length])

  return (
    <div className="storefront">
      <header className="topbar"><a className="wordmark" href="/" aria-label="MiniShop home"><span>MINI</span>SHOP</a><nav className="nav-links" aria-label="Main navigation"><a href="#catalog">Catalog</a><a href="#orders">Orders</a><a href="#services">Services</a><button className="basket-button" type="button" onClick={() => setIsCartOpen(true)}>Basket <span>{cartCount}</span></button></nav><div className="account-area">{session ? <><span className="account-name">{session.user.name} <b>{session.user.role}</b></span><button className="account-button" type="button" onClick={signOut}>Sign out</button></> : <button className="account-button account-login" type="button" onClick={() => { setAuthMode('login'); setIsAuthOpen(true) }}>Sign in</button>}</div></header>
      <main>
        <section className="intro-grid"><div className="intro-copy"><p className="eyebrow">CURATED GOODS / DIRECT FROM THE CATALOG</p><h1>Objects with<br /><em>good energy.</em></h1><p className="intro-text">A tiny, thoughtful shop powered by independent services. Browse the live catalog, build a basket, and check out in one clean flow.</p><a className="text-link" href="#catalog">Explore the collection <span>↓</span></a></div><div className="feature-panel"><div className="feature-label">01 / FEATURED DROP</div>{featuredProduct ? <><div className="feature-art">{featuredProduct.name.slice(0, 1)}</div><div className="feature-meta"><span>{featuredProduct.name}</span><strong>{formatPrice(featuredProduct.price)}</strong></div></> : <div className="feature-empty">Your next favorite thing<br />is being unpacked.</div>}</div></section>
        {(notice || error) && <div className={`alert ${error ? 'alert-error' : 'alert-success'}`} role="status">{error || notice}<button type="button" onClick={() => { setError(''); setNotice('') }} aria-label="Dismiss message">×</button></div>}
        <section id="catalog" className="catalog-section"><div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Available now</h2></div><span className="catalog-count">{catalogLabel}</span></div>{loading ? <div className="state-panel">Loading the live catalog...</div> : products.length === 0 ? <div className="state-panel">No products yet. Add the first item below.</div> : <div className="product-grid">{products.map((product, index) => <article className="product-card" key={product._id}><div className={`product-image image-${index % 4}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{product.name.slice(0, 1)}</strong></div><div className="product-info"><div><h3>{product.name}</h3><p>{product.description || 'A considered addition to your everyday.'}</p></div><strong className="price">{formatPrice(product.price)}</strong></div><div className="product-footer"><span>{product.stock} available</span><button type="button" onClick={() => addToCart(product)}>Add to basket <span>+</span></button></div></article>)}</div>}</section>
        <section id="orders" className="orders-section"><div className="section-heading"><div><p className="eyebrow">ORDER HISTORY</p><h2>Recent orders</h2></div><span className="catalog-count">{orders.length} total</span></div>{ordersLoading ? <div className="state-panel">Loading orders...</div> : orders.length === 0 ? <div className="state-panel">No orders yet. Your first order will appear here.</div> : <div className="orders-list">{orders.map((order) => <article className="order-card" key={order._id}><div className="order-top"><span className="order-id">ORDER / {order._id.slice(-6).toUpperCase()}</span><span className={`order-status status-${order.status.toLowerCase()}`}>{order.status}</span></div><div className="order-items">{order.items.map((item) => <span key={item._id || item.productId}>{item.quantity} × {item.name}</span>)}</div><div className="order-bottom"><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time><strong>{formatPrice(order.total)}</strong></div></article>)}</div>}</section>
        <section id="services" className="lower-grid"><div className="service-note"><p className="eyebrow">BUILT FOR THE FLOW</p><h2>One gateway.<br />Three focused services.</h2><p>Products, orders, and the storefront stay cleanly separated behind the API gateway, so every interaction has one clear path.</p><div className="service-list"><span><b>01</b> product-service</span><span><b>02</b> order-service</span><span><b>03</b> api-gateway</span></div></div>{session?.user.role === 'ADMIN' ? <form className="product-form" onSubmit={submitProduct}><p className="eyebrow">ADMIN CATALOG</p><h2>Add a product</h2><label>Name<input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} placeholder="e.g. Field notebook" /></label><label>Description<input value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} placeholder="A short description" /></label><div className="form-row"><label>Price<input required min="0" step="0.01" type="number" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} placeholder="0.00" /></label><label>Stock<input required min="0" step="1" type="number" value={productForm.stock} onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })} placeholder="0" /></label></div><button className="primary-button" disabled={isAddingProduct} type="submit">{isAddingProduct ? 'Publishing...' : 'Publish product'} <span>→</span></button></form> : <div className="member-panel"><p className="eyebrow">MEMBERSHIP</p><h2>Keep good things moving.</h2><p>Sign in to place orders. Admin accounts can manage the live catalog.</p><button className="primary-button" type="button" onClick={() => { setAuthMode('register'); setIsAuthOpen(true) }}>Create account <span>→</span></button></div>}</section>
      </main>
      <footer><span>MINISHOP / 2026</span><span>REST API / DOCKER / MONGODB</span></footer>
      {isAuthOpen && <div className="overlay" onClick={() => setIsAuthOpen(false)}><aside className="auth-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setIsAuthOpen(false)} aria-label="Close authentication">×</button><p className="eyebrow">MINISHOP MEMBERS</p><h2>{authMode === 'login' ? 'Welcome back.' : 'Join the shop.'}</h2><p className="modal-copy">{authMode === 'login' ? 'Sign in to finish your order.' : 'Create an account to start ordering.'}</p><form onSubmit={submitAuth}>{authMode === 'register' && <label>Name<input required minLength="2" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} placeholder="Your name" /></label>}<label>Email<input required type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@example.com" /></label><label>Password<input required minLength="8" type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="At least 8 characters" /></label><button className="primary-button" type="submit">{authMode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button></form><button className="switch-auth" type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}</button></aside></div>}
      {isCartOpen && <div className="overlay" onClick={() => setIsCartOpen(false)}><aside className="basket" onClick={(event) => event.stopPropagation()}><div className="basket-head"><div><p className="eyebrow">YOUR SELECTION</p><h2>Basket</h2></div><button type="button" onClick={() => setIsCartOpen(false)} aria-label="Close basket">×</button></div>{cart.length === 0 ? <div className="basket-empty">Your basket is waiting.<br />Add something from the collection.</div> : <><div className="basket-items">{cart.map((item) => <div className="basket-item" key={item.productId}><div><h3>{item.name}</h3><p>{formatPrice(item.price)} each</p></div><div className="quantity"><button type="button" onClick={() => changeQuantity(item.productId, -1)} aria-label={`Remove one ${item.name}`}>−</button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.productId, 1)} aria-label={`Add one ${item.name}`}>+</button></div><strong>{formatPrice(item.price * item.quantity)}</strong></div>)}</div><div className="basket-total"><span>Total</span><strong>{formatPrice(cartTotal)}</strong></div><button className="primary-button checkout-button" type="button" disabled={isOrdering} onClick={submitOrder}>{isOrdering ? 'Placing order...' : 'Place order'} <span>→</span></button></>}</aside></div>}
    </div>
  )
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export default App
