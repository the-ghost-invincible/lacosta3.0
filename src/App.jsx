import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './Home'
import { CategoryPage } from './Category'
import { CartPage } from './Cart'
import { LoginPage } from './Login'
import { AccountPage } from './Account'
import { AdminPage, ADMIN_PATH } from './admin/Admin'
import { SearchResults } from './SearchResults'
import { ForgotPassword } from './ForgotPassword'
import { ResetPassword } from './ResetPassword'
import { VerifyEmail } from './VerifyEmail'
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
            <Route path="/search" element={<SearchResults />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify" element={<VerifyEmail />} />
            <Route path={ADMIN_PATH} element={<AdminPage />} />
            <Route path={`${ADMIN_PATH}/products/new`} element={<AdminPage />} />
            <Route path={`${ADMIN_PATH}/products/:id/edit`} element={<AdminPage />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  )
}

export default App
