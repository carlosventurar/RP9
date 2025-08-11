export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Marketing Navigation */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-xl font-bold">RP9</div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm hover:text-primary transition-colors">
                Features
              </a>
              <a href="/pricing" className="text-sm hover:text-primary transition-colors">
                Pricing
              </a>
              <a href="#docs" className="text-sm hover:text-primary transition-colors">
                Docs
              </a>
              <a href="#support" className="text-sm hover:text-primary transition-colors">
                Support
              </a>
            </nav>
          </div>
          
          <div className="flex items-center gap-3">
            <a 
              href="/login" 
              className="text-sm hover:text-primary transition-colors"
            >
              Sign In
            </a>
            <a 
              href="/register" 
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>
      
      {/* Marketing Content */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Marketing Footer */}
      <footer className="border-t bg-secondary/30">
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="text-lg font-semibold mb-3">RP9</div>
              <p className="text-sm text-muted-foreground">
                The most powerful workflow automation platform for modern businesses.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="/pricing" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#integrations" className="hover:text-foreground">Integrations</a></li>
                <li><a href="#templates" className="hover:text-foreground">Templates</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#docs" className="hover:text-foreground">Documentation</a></li>
                <li><a href="#help" className="hover:text-foreground">Help Center</a></li>
                <li><a href="#contact" className="hover:text-foreground">Contact</a></li>
                <li><a href="#status" className="hover:text-foreground">Status</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#about" className="hover:text-foreground">About</a></li>
                <li><a href="#blog" className="hover:text-foreground">Blog</a></li>
                <li><a href="#careers" className="hover:text-foreground">Careers</a></li>
                <li><a href="#privacy" className="hover:text-foreground">Privacy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-8 pt-4 text-center text-sm text-muted-foreground">
            © 2024 RP9. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}