import { Header } from './Header'
import { Link } from 'react-router-dom'
import './App.css'

export function PrivacyPolicy() {
  return (
    <div className="page-shell">
      <Header />
      <main className="container page-content">
        <section className="legal-page">
          <h1>Privacy Policy</h1>
          <p className="legal-updated">Last updated: August 2026</p>

          <h2>1. Information We Collect</h2>
          <p>When you use Lacosta, we collect:</p>
          <ul>
            <li><strong>Account information:</strong> email address, username, display name, phone number</li>
            <li><strong>Order data:</strong> items purchased, delivery details, payment references</li>
            <li><strong>Usage data:</strong> pages visited, search queries, browser type</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use your data to:</p>
          <ul>
            <li>Process and deliver your orders</li>
            <li>Send order confirmations and delivery updates</li>
            <li>Improve our marketplace and user experience</li>
            <li>Detect and prevent fraud or abuse</li>
          </ul>

          <h2>3. Data Sharing</h2>
          <p>We do <strong>not</strong> sell your personal data. We share it only with:</p>
          <ul>
            <li>Sellers — to fulfill your orders (name, phone, delivery address)</li>
            <li>Payment providers — to process M-Pesa transactions</li>
            <li>Service providers — email delivery (Resend), hosting, analytics</li>
          </ul>

          <h2>4. Data Security</h2>
          <p>We use industry-standard encryption (HTTPS), secure password hashing (scrypt), and database access controls. No payment card details are stored on our servers.</p>

          <h2>5. Your Rights</h2>
          <p>You can:</p>
          <ul>
            <li>Access and update your account information in your <Link to="/account">account settings</Link></li>
            <li>Request deletion of your account by contacting us</li>
            <li>Opt out of non-essential communications</li>
          </ul>

          <h2>6. Cookies</h2>
          <p>We use essential cookies for authentication and session management. No third-party tracking cookies are used.</p>

          <h2>7. Data Retention</h2>
          <p>We retain your data as long as your account is active. Order records are kept for legal and accounting purposes for up to 7 years.</p>

          <h2>8. Contact</h2>
          <p>For privacy-related questions, contact us at:</p>
          <ul>
            <li>Phone: 0112974286</li>
            <li>Email: privacy@lacosta.co.ke</li>
          </ul>
        </section>
      </main>
    </div>
  )
}

export function TermsOfService() {
  return (
    <div className="page-shell">
      <Header />
      <main className="container page-content">
        <section className="legal-page">
          <h1>Terms of Service</h1>
          <p className="legal-updated">Last updated: August 2026</p>

          <h2>1. Acceptance</h2>
          <p>By using Lacosta, you agree to these terms. If you do not agree, please do not use our platform.</p>

          <h2>2. Account Responsibilities</h2>
          <ul>
            <li>You must provide accurate information when creating an account</li>
            <li>You are responsible for keeping your password secure</li>
            <li>You must be at least 18 years old to make purchases</li>
          </ul>

          <h2>3. Orders and Payments</h2>
          <ul>
            <li>Prices are displayed in Kenyan Shillings (KSh)</li>
            <li>Payment can be made via M-Pesa or cash on delivery</li>
            <li>Orders are subject to availability and seller confirmation</li>
            <li>We reserve the right to cancel orders with incorrect pricing</li>
          </ul>

          <h2>4. Delivery</h2>
          <ul>
            <li>Delivery times are estimates and not guaranteed</li>
            <li>Free delivery applies to orders above KSh 10,000</li>
            <li>Risk of loss transfers to you upon delivery</li>
          </ul>

          <h2>5. Returns and Refunds</h2>
          <p>See our <Link to="/refund-policy">Refund Policy</Link> for details on returns, exchanges, and refunds.</p>

          <h2>6. Prohibited Conduct</h2>
          <p>You may not:</p>
          <ul>
            <li>Use the platform for illegal purposes</li>
            <li>Attempt to hack or overload our systems</li>
            <li>Post false or misleading product information</li>
            <li>Harass other users or sellers</li>
          </ul>

          <h2>7. Intellectual Property</h2>
          <p>All content on Lacosta (logos, designs, text) is our property or licensed to us. You may not copy or reproduce it without permission.</p>

          <h2>8. Limitation of Liability</h2>
          <p>Lacosta acts as a marketplace connecting buyers and sellers. We are not liable for product quality, seller conduct, or delivery issues beyond our control.</p>

          <h2>9. Changes</h2>
          <p>We may update these terms at any time. Continued use of the platform constitutes acceptance of updated terms.</p>

          <h2>10. Contact</h2>
          <p>Phone: 0112974286 | Email: legal@lacosta.co.ke</p>
        </section>
      </main>
    </div>
  )
}

export function RefundPolicy() {
  return (
    <div className="page-shell">
      <Header />
      <main className="container page-content">
        <section className="legal-page">
          <h1>Refund Policy</h1>
          <p className="legal-updated">Last updated: August 2026</p>

          <h2>1. Eligibility</h2>
          <p>You may request a refund if:</p>
          <ul>
            <li>The product is defective or damaged on arrival</li>
            <li>The wrong product was delivered</li>
            <li>The product does not match the description on our platform</li>
            <li>The order was canceled before dispatch</li>
          </ul>

          <h2>2. Timeframe</h2>
          <ul>
            <li>Refund requests must be made within <strong>7 days</strong> of delivery</li>
            <li>Items must be returned in their original condition and packaging</li>
            <li>Perishable goods (groceries, drinks) cannot be returned unless defective</li>
          </ul>

          <h2>3. How to Request a Refund</h2>
          <ol>
            <li>Contact us at 0112974286 or refunds@lacosta.co.ke</li>
            <li>Provide your order number and reason for the refund</li>
            <li>We will review your request within 48 hours</li>
            <li>If approved, we will arrange a return pickup or provide return instructions</li>
          </ol>

          <h2>4. Refund Processing</h2>
          <ul>
            <li>Refunds are processed to your M-Pesa number within 5-7 business days</li>
            <li>Cash on delivery refunds are processed via M-Pesa transfer</li>
            <li>Delivery fees are non-refundable unless the error was ours</li>
          </ul>

          <h2>5. Non-Refundable Items</h2>
          <ul>
            <li>Perishable goods (unless defective)</li>
            <li>Personalized or custom-made items</li>
            <li>Items damaged by misuse or normal wear and tear</li>
            <li>Digital products once delivered</li>
          </ul>

          <h2>6. Contact</h2>
          <p>Phone: 0112974286 | Email: refunds@lacosta.co.ke</p>
        </section>
      </main>
    </div>
  )
}
