import { HelpCircle, ChevronDown } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function FAQPage() {
  const faqCategories = [
    {
      title: "General Questions",
      questions: [
        {
          q: "What is CineBook?",
          a: "CineBook is a modern movie ticket booking platform that allows you to browse movies, select seats, and book tickets online for your favorite cinema theaters."
        },
        {
          q: "Do I need to create an account to book tickets?",
          a: "Yes, you need to create a CineBook account to book tickets. This helps us manage your bookings and send you confirmation details."
        },
        {
          q: "What payment methods are accepted?",
          a: "We accept all major credit/debit cards, digital wallets, and net banking options for secure payment processing."
        }
      ]
    },
    {
      title: "Booking & Tickets",
      questions: [
        {
          q: "How do I book movie tickets?",
          a: "Simply navigate to the movie list, select your preferred movie and showtime, choose your seats, and proceed to payment. You'll receive a confirmation email with your ticket details."
        },
        {
          q: "Can I modify my booking after confirmation?",
          a: "You can but you need to contact with us through hotline 2 hours before showtime."
        },
        {
          q: "How many tickets can I book at once?",
          a: "You can book up to 8 tickets per transaction. If you need to book more, please contact our customer support team."
        }
      ]
    },
    {
      title: "Cancellation & Refunds",
      questions: [
        {
          q: "Can I cancel my booking?",
          a: "Yes, you can cancel your booking anytime before the showtime. Refund eligibility depends on when you cancel - refer to our cancellation policy for details."
        },
        {
          q: "What is the refund policy?",
          a: "Cancellations made 24 hours before showtime receive a full refund. Cancellations between 12-24 hours receive 80%, 2-12 hours receive 50%. No refunds for cancellations within 2 hours."
        },
        {
          q: "How long does it take to receive a refund?",
          a: "Refunds are processed within 5-7 business days after cancellation. The amount will be credited back to your original payment method."
        },
        {
          q: "What if the show is canceled?",
          a: "If a show is canceled by the theater, you'll receive a full refund or can reschedule for another showtime of the same movie."
        }
      ]
    },
    {
      title: "Account & Membership",
      questions: [
        {
          q: "How do I reset my password?",
          a: "Click on 'Forgot Password' on the login page and follow the instructions sent to your registered email address."
        },
        {
          q: "What are the membership benefits?",
          a: "CineBook members enjoy exclusive discounts on ticket bookings, early access to bookings, special promotions, and reward points on every purchase."
        },
        {
          q: "How do reward points work?",
          a: "You earn reward points on every ticket booking. Points can be redeemed for discounts on future bookings or special offers. Points expire after 12 months of inactivity."
        },
        {
          q: "Can I have multiple accounts?",
          a: "Each person should maintain only one account. Multiple accounts may be flagged for suspicious activity and suspended."
        }
      ]
    },
    {
      title: "Technical Support",
      questions: [
        {
          q: "Why is the website not loading properly?",
          a: "Try clearing your browser cache and cookies, or use a different browser. If the issue persists, contact our technical support team."
        },
        {
          q: "My payment failed - what should I do?",
          a: "Check your internet connection and ensure your payment details are correct. Try again or use a different payment method. Contact support if the issue continues."
        },
        {
          q: "I didn't receive my booking confirmation email",
          a: "Check your spam or promotional folder. If you still don't see it, log into your account to view your bookings. Contact support if you need assistance."
        },
        {
          q: "Is CineBook secure?",
          a: "Yes, CineBook uses industry-standard SSL encryption and secure payment gateways to protect your personal and financial information."
        }
      ]
    },
    {
      title: "Customer Support",
      questions: [
        {
          q: "How can I contact customer support?",
          a: "You can reach our support team via email at support@cinebook.com, phone at +1 (555) 123-4567, or through our contact form. Our support hours are 8:00 AM - 10:00 PM daily."
        },
        {
          q: "What is the average response time?",
          a: "We aim to respond to all inquiries within 2 hours during business hours. For urgent matters, please call our customer support hotline."
        },
        {
          q: "Can I provide feedback or suggestions?",
          a: "We'd love to hear from you! Please use our contact form or email us directly. Your feedback helps us improve our service."
        },
        {
          q: "How do I report a problem?",
          a: "Contact our support team immediately via email, phone, or the contact form with details about the issue. Include your booking reference number if applicable."
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-24">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Frequently Asked Questions
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Find answers to common questions about booking, payments, cancellations, and more. If you can't find what you're looking for, contact our support team.
          </p>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                <ChevronDown className="h-6 w-6 text-primary" />
                {category.title}
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {category.questions.map((item, questionIndex) => (
                  <AccordionItem 
                    key={questionIndex} 
                    value={`${categoryIndex}-${questionIndex}`}
                    className="border border-border rounded-lg px-4 hover:border-primary/50 transition-colors"
                  >
                    <AccordionTrigger className="text-left hover:text-primary hover:no-underline no-underline transition-colors py-4">
                      <span className="font-semibold text-foreground">{item.q}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Didn't find your answer?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Our customer support team is here to help. Reach out to us anytime and we'll be happy to assist you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/contact" className="inline-flex items-center justify-center px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Contact Us
            </a>
            <a href="mailto:support@cinebook.com" className="inline-flex items-center justify-center px-6 py-2 rounded-lg border border-primary text-primary hover:bg-primary/5 transition-colors">
              Email Support
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
