import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, ShieldCheck, Upload, UserCog, Fingerprint } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <div className="text-center py-12">
        <div className="max-w-3xl mx-auto px-4">
          <Fingerprint className="h-24 w-24 text-primary mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Cryptographically Secured Promises
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Create tamper-proof promises encrypted with your biometric data and validated with certificates.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth?mode=register">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started
              </Button>
            </Link>
            <Link href="/auth?mode=login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Secure Authentication</h3>
              <p className="text-slate-600 text-sm">
                Use your fingerprint or Face ID for secure, passwordless login
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Promise Creation</h3>
              <p className="text-slate-600 text-sm">
                Create cryptographically secured promises with biometric encryption
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="pt-8 pb-6">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCog className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Role Management</h3>
              <p className="text-slate-600 text-sm">
                Admin and user roles with appropriate access controls
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center mb-4 sm:mb-0">
              <Shield className="text-primary mr-2" />
              <span className="text-slate-600 text-sm">PromiseShare - Powered by WebAuthn</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 text-sm text-slate-500">
              <span>Cryptographic Promise Security</span>
              <span className="hidden sm:inline">•</span>
              <span>Biometric Encryption</span>
              <span className="hidden sm:inline">•</span>
              <span>Certificate Validation</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
