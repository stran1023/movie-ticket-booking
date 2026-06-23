import { Card } from "@/components/ui/card"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Terms & Policies
          </h1>
          <p className="text-lg text-muted-foreground">
            Last updated: March 2026
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="mx-auto max-w-4xl px-4 pb-16">
        <div className="space-y-8">
          {/* Terms of Service */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Terms of Service</h2>
            
            <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
              <div>
                <h3 className="font-semibold text-foreground mb-2">1. Acceptance of Terms</h3>
                <p>
                  By accessing and using CineBook, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">2. Use License</h3>
                <p>
                  Permission is granted to temporarily download one copy of the materials (information or software) on CineBook for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Modifying or copying the materials</li>
                  <li>Using the materials for any commercial purpose or for any public display</li>
                  <li>Attempting to decompile or reverse engineer any software contained on CineBook</li>
                  <li>Removing any copyright or other proprietary notations from the materials</li>
                  <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">3. Booking Confirmation</h3>
                <p>
                  All movie ticket bookings must be confirmed via email. A confirmation number will be provided which must be presented at the cinema. Failure to present the confirmation may result in seat reassignment.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">4. User Responsibilities</h3>
                <p>
                  You are responsible for maintaining the confidentiality of your account information and password. You agree to accept responsibility for all activities that occur under your account. You must notify CineBook immediately of any unauthorized use of your account.
                </p>
              </div>
            </div>
          </Card>

          {/* Refund Policy */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Refund Policy</h2>
            
            <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Refund Eligibility</h3>
                <p>
                  Refunds are available under the following conditions:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Cancellation made at least 24 hours before the show time</li>
                  <li>No refunds will be issued for cancellations made within 24 hours of the show</li>
                  <li>Refunds are processed within 5-7 business days</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Non-Refundable Items</h3>
                <p>
                  Promotional or discounted tickets are non-refundable. Tickets purchased with reward points cannot be refunded; points will be forfeited upon cancellation.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Modification of Bookings</h3>
                <p>
                  You may modify your booking up to 24 hours before the show time. Modifications include changing the date, time, or seats. A small modification fee may apply.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">No-Show Policy</h3>
                <p>
                  If you do not arrive 15 minutes before the show time, your booking will be considered a no-show and no refund will be issued.
                </p>
              </div>
            </div>
          </Card>

          {/* Cancellation Policy */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Cancellation Policy</h2>
            
            <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
              <p>
                You can cancel your booking up to 24 hours before the show time through your account dashboard or by contacting our customer support team. Cancellation requests submitted within 24 hours of the show time will not be eligible for refund.
              </p>
              <p>
                In case of cinema closure due to unforeseen circumstances, we will provide you with alternative dates or full refunds.
              </p>
            </div>
          </Card>

          {/* Privacy Policy */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Privacy Policy</h2>
            
            <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Information Collection</h3>
                <p>
                  CineBook collects personal information that you voluntarily provide such as your name, email address, phone number, and payment information. We also collect non-personal information such as browser type, IP address, and pages visited.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Information Usage</h3>
                <p>
                  We use your information to:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Process your bookings and payments</li>
                  <li>Send you confirmation and booking details</li>
                  <li>Provide customer support</li>
                  <li>Send promotional offers and newsletters (with your consent)</li>
                  <li>Improve our services and user experience</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Data Security</h3>
                <p>
                  We implement appropriate security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Third-Party Sharing</h3>
                <p>
                  We do not sell, trade, or rent your personal information to third parties. We may share information with trusted partners necessary to process your transactions or provide services you've requested.
                </p>
              </div>
            </div>
          </Card>

          {/* Payment Terms */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Payment Terms</h2>
            
            <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Accepted Payment Methods</h3>
                <p>
                  We accept all major credit cards, debit cards, digital wallets, and online banking transfers. Payment is required at the time of booking.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Payment Security</h3>
                <p>
                  All transactions are encrypted and processed through secure payment gateways. Your payment information is never stored on our servers.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Transaction Disputes</h3>
                <p>
                  If you dispute a transaction, please contact our support team within 30 days. We will investigate and resolve the issue promptly.
                </p>
              </div>
            </div>
          </Card>

          {/* Limitation of Liability */}
          <Card className="p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Limitation of Liability</h2>
            
            <div className="space-y-4 text-muted-foreground text-sm leading-relaxed">
              <p>
                CineBook and its suppliers will not be liable for any damages arising from the use of this website, including but not limited to indirect, incidental, special, consequential, or punitive damages, even if advised of the possibility of such damages.
              </p>
            </div>
          </Card>

          {/* Contact Us */}
          <Card className="p-8 bg-primary/5 border-primary/20">
            <h2 className="text-2xl font-bold text-foreground mb-4">Questions About Our Policies?</h2>
            
            <div className="space-y-3 text-muted-foreground text-sm">
              <p>
                If you have any questions or concerns about these terms and policies, please contact us:
              </p>
              <ul className="space-y-2">
                <li><strong>Email:</strong> support@cinebook.com</li>
                <li><strong>Phone:</strong> +1 (555) 123-4567</li>
                <li><strong>Hours:</strong> Monday - Sunday, 8:00 AM - 10:00 PM</li>
              </ul>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
