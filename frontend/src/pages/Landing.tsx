import { Link } from 'react-router-dom';
import { Shield, Zap, Brain, BarChart3, AlertTriangle, Lock, Globe, Waves, ArrowRight, CheckCircle2 } from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-on-surface overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/3 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-outline/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-container rounded-xl flex items-center justify-center shadow-glow">
              <Shield className="w-5 h-5 text-surface-lowest" />
            </div>
            <div>
              <p className="font-display font-bold text-lg tracking-tight">HawkEye AI</p>
              <p className="text-primary text-[8px] font-mono tracking-widest uppercase">Threat Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="px-4 py-2 text-sm font-medium text-on-surface hover:text-primary transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="px-4 py-2 bg-primary text-surface-lowest rounded-lg text-sm font-medium hover:bg-primary-container transition-all shadow-glow hover:shadow-glow-primary">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-20 md:py-32 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Real-time Threat Detection</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight tracking-tight">
              Threats Detected.
              <span className="block bg-gradient-to-r from-primary via-primary-container to-secondary bg-clip-text text-transparent">
                Instantly Analyzed.
              </span>
            </h1>
            
            <p className="text-lg text-on-surface-variant/80 leading-relaxed max-w-xl">
              HawkEye AI combines advanced threat intelligence with machine learning to detect, analyze, and respond to security threats in real-time. Protect your infrastructure with intelligent, AI-powered security monitoring.
            </p>
            
            <div className="flex gap-4 pt-4">
              <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-surface-lowest rounded-lg font-semibold hover:bg-primary-container transition-all shadow-glow hover:shadow-glow-primary group">
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 border border-primary/30 text-primary rounded-lg font-semibold hover:bg-primary/10 transition-all">
                View Demo
                <Waves className="w-4 h-4" />
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-outline/10">
              <div>
                <p className="text-2xl font-bold text-primary">99.9%</p>
                <p className="text-sm text-on-surface-variant/60">Uptime SLA</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">&lt;1ms</p>
                <p className="text-sm text-on-surface-variant/60">Detection Latency</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">24/7</p>
                <p className="text-sm text-on-surface-variant/60">Monitoring</p>
              </div>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative h-96 md:h-full flex items-center justify-center">
            <div className="glass-panel rounded-2xl p-6 w-full border border-primary/20 shadow-lg relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Animated threat detection visualization */}
              <div className="relative z-10">
                <div className="space-y-4">
                  {[
                    { label: 'Critical', value: 12, color: 'from-error' },
                    { label: 'High', value: 24, color: 'from-warning' },
                    { label: 'Medium', value: 18, color: 'from-primary' },
                    { label: 'Low', value: 30, color: 'from-secondary' },
                  ].map((item, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-primary font-bold">{item.value}</span>
                      </div>
                      <div className="h-2 bg-surface rounded-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${item.color} to-primary rounded-full`}
                          style={{ width: `${(item.value / 40) * 100}%`, animation: `pulse 2s ease-in-out infinite` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant/60 mt-4 font-mono">⚡ Live threat feed</p>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 glass-panel rounded-full p-4 border border-primary/20 shadow-glow animate-bounce">
              <AlertTriangle className="w-6 h-6 text-error" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-6 py-20 md:py-32 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Powerful Features</h2>
          <p className="text-lg text-on-surface-variant/70 max-w-2xl mx-auto">
            Everything you need to detect, investigate, and respond to security threats
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Brain,
              title: 'AI-Powered Analysis',
              description: 'Machine learning models trained on millions of threat signatures for accurate detection',
              color: 'from-primary'
            },
            {
              icon: Zap,
              title: 'Real-Time Detection',
              description: 'Detect threats in milliseconds and respond before they impact your systems',
              color: 'from-warning'
            },
            {
              icon: BarChart3,
              title: 'Advanced Analytics',
              description: 'Visualize threat trends, patterns, and hotspots across your infrastructure',
              color: 'from-secondary'
            },
            {
              icon: AlertTriangle,
              title: 'Smart Alerts',
              description: 'Intelligent alerting with customizable thresholds and intelligent prioritization',
              color: 'from-error'
            },
            {
              icon: Lock,
              title: 'Investigation Tools',
              description: 'Deep-dive into threat details with comprehensive forensic analysis',
              color: 'from-primary'
            },
            {
              icon: Globe,
              title: 'Threat Intelligence',
              description: 'Leverage global threat databases and community intelligence feeds',
              color: 'from-secondary'
            },
          ].map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="glass-panel rounded-2xl p-6 border border-outline/10 hover:border-primary/30 transition-all group cursor-pointer">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} to-primary-container flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow`}>
                  <Icon className="w-6 h-6 text-surface-lowest" />
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-on-surface-variant/70 text-sm leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative px-6 py-20 md:py-32 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">How It Works</h2>
          <p className="text-lg text-on-surface-variant/70 max-w-2xl mx-auto">
            Simple setup, powerful protection
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {[
            { step: '01', title: 'Connect', description: 'Integrate your security logs and data sources' },
            { step: '02', title: 'Analyze', description: 'AI analyzes threats in real-time' },
            { step: '03', title: 'Investigate', description: 'Deep-dive into threat details' },
            { step: '04', title: 'Respond', description: 'Take action with intelligent recommendations' },
          ].map((item, i) => (
            <div key={i} className="relative">
              <div className="glass-panel rounded-xl p-6 border border-outline/10">
                <div className="text-3xl font-bold text-primary mb-4">{item.step}</div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-on-surface-variant/70 text-sm">{item.description}</p>
              </div>
              {i < 3 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 transform -translate-y-1/2 z-10">
                  <ArrowRight className="w-6 h-6 text-primary/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="relative px-6 py-20 md:py-32 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-display font-bold">Why Choose HawkEye?</h2>
            <div className="space-y-4">
              {[
                'Fastest threat detection in the industry',
                'Reduce investigation time by 90%',
                'AI-powered threat prioritization',
                'Comprehensive audit logging',
                'Multi-team collaboration tools',
                '24/7 Expert support',
              ].map((benefit, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                  <span className="text-on-surface-variant">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-8 border border-primary/20 space-y-6">
            <div className="inline-flex items-center gap-2 bg-error/10 rounded-full px-3 py-1 w-fit">
              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="text-xs font-mono text-error">LIVE MONITORING</span>
            </div>
            
            <div>
              <p className="text-sm text-on-surface-variant/70 mb-2">Active Threats</p>
              <p className="text-4xl font-bold text-primary">847</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Detection Rate</span>
                <span className="text-primary font-semibold">99.2%</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full w-[99.2%] bg-gradient-to-r from-primary to-primary-container rounded-full" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Response Time</span>
                <span className="text-primary font-semibold">0.8ms</span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full w-[95%] bg-gradient-to-r from-primary to-primary-container rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-6 py-20 md:py-32 max-w-7xl mx-auto">
        <div className="glass-panel rounded-3xl p-12 border border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 opacity-0 hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10 text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-display font-bold">Ready to Protect Your Infrastructure?</h2>
            <p className="text-lg text-on-surface-variant/70 max-w-2xl mx-auto">
              Join thousands of security teams using HawkEye AI to detect and respond to threats faster
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary text-surface-lowest rounded-lg font-semibold hover:bg-primary-container transition-all shadow-glow hover:shadow-glow-primary">
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-primary/30 text-primary rounded-lg font-semibold hover:bg-primary/10 transition-all">
                Sign In to Dashboard
              </Link>
            </div>

            <p className="text-sm text-on-surface-variant/60 pt-2">
              No credit card required. 14-day free trial included.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-6 py-12 border-t border-outline/10 mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <span className="font-bold">HawkEye AI</span>
              </div>
              <p className="text-sm text-on-surface-variant/70">
                AI-powered threat intelligence and security monitoring
              </p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Security', 'Pricing'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers'] },
              { title: 'Resources', links: ['Documentation', 'API', 'Support'] },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="font-semibold mb-3">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <a href="#" className="text-sm text-on-surface-variant/70 hover:text-primary transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-outline/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-on-surface-variant/60">
              © 2026 HawkEye AI. All rights reserved.
            </p>
            <div className="flex gap-6">
              {['Privacy', 'Terms', 'Security'].map((item, i) => (
                <a key={i} href="#" className="text-sm text-on-surface-variant/70 hover:text-primary transition-colors">
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
