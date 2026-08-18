import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './Home'
import { CategoryPage } from './Category'
import { CartPage } from './Cart'
import { AdminPage, ADMIN_PATH } from './admin/Admin'
import { CartProvider } from './CartContext'
import './App.css'

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/category/:categorySlug" element={<CategoryPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path={ADMIN_PATH} element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  )
}

export default App
