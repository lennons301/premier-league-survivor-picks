import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const { user, signOut } = useAuth();

  return (
    <nav className="border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2">
          <Shield className="text-primary" size={20} />
          <span className="text-lg sm:text-xl font-bold">LPS</span>
        </Link>

        <div className="hidden sm:flex items-center gap-6">
          <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">
            Home
          </Link>
          {user && (
            <Link to="/games" className="text-sm font-medium hover:text-primary transition-colors">
              Games
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <>
              <div className="hidden md:flex items-center gap-2">
                <User size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium truncate max-w-32">{user.email}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="flex items-center gap-1.5"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button variant="default" size="sm" className="text-sm">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
