import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Shield, LogOut, User, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const NavLinks = () => (
    <>
      <Link 
        to="/" 
        className="text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setIsOpen(false)}
      >
        Home
      </Link>
      {user && (
        <Link 
          to="/games" 
          className="text-sm font-medium hover:text-primary transition-colors"
          onClick={() => setIsOpen(false)}
        >
          Games
        </Link>
      )}
    </>
  );

  return (
    <nav className="border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2">
          <Shield className="text-primary" size={20} />
          <span className="text-lg sm:text-xl font-bold">LPS</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <NavLinks />
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden lg:flex items-center gap-2">
                <User size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-32">{user.email}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="hidden sm:flex items-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="sm:hidden"
              >
                <LogOut size={14} />
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm" className="text-sm">
                Sign In
              </Button>
            </Link>
          )}

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="flex flex-col gap-4 mt-6">
                <NavLinks />
                {user && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-4">
                      <User size={16} className="text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{user.email}</span>
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
