import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './Home'
import { CategoryPage } from './Category'
import { CartPage } from './Cart'
import { LoginPage } from './Login'
import { AccountPage } from './Account'
import { AdminPage, ADMIN_PATH } from './admin/Admin'
import { CartProvider } from './CartContext'
import { AuthProvider } from './AuthContext'
import { UsernameSetup } from './UsernameSetup'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <UsernameSetup />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/category/:categorySlug" element={<CategoryPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path={ADMIN_PATH} element={<AdminPage />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
