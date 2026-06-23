import { Film, Award, Users, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-4 py-16 md:py-24">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Film className="h-8 w-8 text-primary" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              About CineBook
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Your premier destination for movie ticket booking. We bring the magic of cinema directly to you.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-xl bg-primary/5 p-8 border border-primary/10">
          <h2 className="text-2xl font-bold text-foreground mb-4">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            At CineBook, we believe that watching movies should be simple, enjoyable, and hassle-free. Our mission is to revolutionize the way you book movie tickets by providing a seamless, user-friendly platform that connects movie lovers with their favorite cinema experiences.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            We're committed to delivering exceptional service, competitive pricing, and exclusive promotions to make your cinema visits more rewarding.
          </p>
        </div>
      </section>

      {/* Values Section */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-2xl font-bold text-foreground mb-12 text-center">Why Choose CineBook</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <Film className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Wide Selection</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Browse and book tickets for the latest blockbusters and independent films from multiple theaters.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Easy Booking</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Simple and intuitive interface that makes booking your favorite seats quick and effortless.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Exclusive Deals</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Access special promotions and member-only offers to make your cinema experience more affordable.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <Heart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Member Rewards</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Earn points on every booking and redeem them for discounts and special privileges.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <p className="text-3xl font-bold text-primary mb-2">10K+</p>
            <p className="text-sm text-muted-foreground">Happy Customers</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary mb-2">8+</p>
            <p className="text-sm text-muted-foreground">Movies Available</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-primary mb-2">4</p>
            <p className="text-sm text-muted-foreground">Cinema Halls</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 p-8 text-center border border-primary/10">
          <h2 className="text-2xl font-bold text-foreground mb-4">Ready to Book Your Next Movie?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Start your cinema journey with CineBook today and discover amazing movies and exclusive deals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/movies">
              <Button size="lg">
                Browse Movies
              </Button>
            </Link>
            <Link href="/booking">
              <Button size="lg" variant="outline">
                Book Tickets
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
