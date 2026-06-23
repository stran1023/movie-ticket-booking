import { AlertCircle, Ticket, Clock, Users, AlertTriangle, Film, Shield } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function RulesPage() {
  const rules = [
    {
      icon: Ticket,
      title: "Theater Conduct Rules",
      items: [
        "No video or audio recording of films is permitted",
        "Turn off your mobile phone or use silent mode",
        "No smoking is allowed in the cinema premises",
        "Do not disturb other guests or create any disturbance",
        "No chewing gum is allowed",
        "Pets are not permitted inside the cinema",
        "Personal items must be kept secure at all times",
        "Only food and beverages purchased at CineBook may be brought into the theater",
        "No alcohol consumption of any kind is permitted in the cinema premises",
        "CineBook cinema has security cameras throughout the premises"
      ]
    },
    {
      icon: Film,
      title: "Film Classification",
      items: [
        "P - General audiences of all ages",
        "K - Children under 13 with parental supervision required",
        "T13 - Suitable for ages 13 and above (13+)",
        "T16 - Suitable for ages 16 and above (16+)",
        "T18 - Suitable for ages 18 and above (18+)",
        "C - Not permitted for public screening",
        "Valid ID with photo and birthdate must be presented for T13, T16, and T18 rated films",
        "Acceptable ID: Birth Certificate, National ID Card, Student ID, Passport, Driver's License",
        "Management reserves the right to refuse entry if age requirements are not met",
        "Penalties for non-compliance: violation fines apply"
      ]
    },
    {
      icon: Clock,
      title: "Viewing Time Restrictions",
      items: [
        "Children under 13 must not view films ending after 10:00 PM",
        "Children under 16 must not view films ending after 11:00 PM",
        "Management has the right to verify age and refuse entry if restrictions are violated",
        "Valid identification may be required to prove age compliance",
        "Penalties for non-compliance: violation fines apply"
      ]
    },
    {
      icon: Users,
      title: "Ticket Pricing by Customer Type",
      items: [
        "Children: Under 16 years old or under 130cm in height",
        "U22 Members: Ages 12-22 with valid U22 membership",
        "Young Adults: Under 23 years old with valid ID",
        "Seniors: 55 years old and above",
        "People with Revolutionary Contributions: Valid documentation required",
        "Low-Income Groups: Valid certification required",
        "Persons with Severe Disabilities: 50% discount (requires documentation)",
        "Persons with Special Severe Disabilities: Free admission",
        "One customer per ticket per transaction. Valid ID may be required for verification",
        "Special discounts apply only for in-person purchases at the theater; online bookings do not qualify for discounts"
      ]
    },
    {
      icon: Shield,
      title: "Cancellation & Refund Policy",
      items: [
        "Cancellations must be made at least 24 hours before showtime for full refund",
        "Cancellations within 24 hours may result in reduced refunds or credits",
        "Refunds will be processed according to the payment method used",
        "Technical issues may be subject to credit toward future bookings instead of cash refunds",
        "Refund requests must be submitted through official CineBook channels",
        "Management decisions regarding disputed refunds are final"
      ]
    },
    {
      icon: AlertTriangle,
      title: "General Policies",
      items: [
        "CineBook reserves the right to modify these rules and policies at any time",
        "Violation of theater conduct rules may result in expulsion without refund",
        "Management has the right to review and deny entry to customers violating age restrictions",
        "Security cameras monitor all areas of the cinema for safety and compliance",
        "All disputes and complaints will be resolved according to CineBook management's judgment",
        "By booking tickets, you agree to comply with all rules and policies stated herein"
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-24">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              CineBook Rules & Regulations
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            At CineBook, we maintain high standards to ensure a safe, respectful, and enjoyable cinema experience for all our guests. Please take time to review our complete rules and policies.
          </p>
        </div>
      </section>

      {/* Important Notice */}
      <section className="mx-auto max-w-4xl px-4 py-8">
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Important Notice:</strong> By booking tickets with CineBook, you are agreeing to comply with all the rules, regulations, and policies outlined below. Failure to adhere to these guidelines may result in denied entry, expulsion from the theater, or cancellation without refund. CineBook management reserves the right to enforce these policies at any time.
          </AlertDescription>
        </Alert>
      </section>

      {/* Rules Grid */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {rules.map((section, index) => {
            const Icon = section.icon
            return (
              <div key={index} className="rounded-lg border border-border bg-card p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-3 mb-4">
                  <Icon className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
                </div>
                <ul className="space-y-3">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="text-primary font-semibold flex-shrink-0 mt-1">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* Contact Section */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Need Clarification on Our Rules?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            For any questions, concerns, or disputes regarding our rules and policies, our customer support team is here to help. Contact us via email, phone, or visit our contact page.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="mailto:support@cinebook.com" className="inline-flex items-center justify-center px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Email Us
            </a>
            <a href="/contact" className="inline-flex items-center justify-center px-6 py-2 rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors">
              Contact Us
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
