import { HomeSimulation } from './modules/home/home';
import { PhysarumSimulation } from './modules/physarum/physarum';
import { DiffusionSimulation } from './modules/diffusion/diffusion';
import { WaveSimulation } from './modules/waves/waves';

class PortfolioApp {
   private currentSimulation: HomeSimulation | WaveSimulation | PhysarumSimulation | DiffusionSimulation | null = null;
   private navLinks: NodeListOf<HTMLElement>;
   private pages: NodeListOf<HTMLElement>;
   private navbar: HTMLElement | null;

   constructor() {
      this.navLinks = document.querySelectorAll('.nav-link');
      this.pages = document.querySelectorAll('.page');
      this.navbar = document.querySelector('.navbar');

      this.initShowMenu();

      this.initNavigation();
   }

   private async initShowMenu() {
      const navbar = document.getElementById("nav");
      const navTrigger = document.getElementsByClassName("navbar-trigger");
      navbar!.style.top = "20px";
      window.setTimeout(() => {
         navbar!.style.top = "-60px";
      }, 1000);

      navTrigger[0].addEventListener('mouseover', (_) => {
         navbar!.style.top = "20px";
      });
      navbar?.addEventListener('mouseleave', (_) => {
         navbar!.style.top = "-60px";
      });
   }

   private initNavigation(): void {
      this.navLinks.forEach(link => {
         link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.getAttribute('data-page');
            if (targetPage) {
               this.navigateToPage(targetPage);
            }
         });
      });

      this.navigateToPage("home");
   }

   private async navigateToPage(targetPage: string): Promise<void> {
      // Clean up current simulation
      if (this.currentSimulation && 'destroy' in this.currentSimulation) {
         this.currentSimulation.destroy();
         this.currentSimulation = null;

         await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update navigation state
      this.updateNavigation(targetPage);

      // Initialize new simulation
      await this.initSimulation(targetPage);
   }

   private updateNavigation(targetPage: string): void {
      // Update active nav link
      this.navLinks.forEach(l => l.classList.remove('active'));
      document.querySelector(`[data-page="${targetPage}"]`)?.classList.add('active');

      // Show target page
      this.pages.forEach(p => p.classList.remove('active'));
      document.getElementById(targetPage)?.classList.add('active');

      // Close mobile menu
      this.navbar?.classList.remove('show');
   }

   private async initSimulation(targetPage: string): Promise<void> {
      try {
         switch (targetPage) {
            case 'home':
               this.currentSimulation = new HomeSimulation();
               await this.currentSimulation.init();
               break;
            case 'physarum':
               this.currentSimulation = new PhysarumSimulation();
               await this.currentSimulation.init();
               break;
            case 'diffusion':
               this.currentSimulation = new DiffusionSimulation();
               await this.currentSimulation.init();
               break;
            case 'waves':
               this.currentSimulation = new WaveSimulation();
               await this.currentSimulation.init();
               break;
         }
      } catch (error) {
         console.error(`Failed to initialize ${targetPage} simulation:`, error);
      }
   }

   // ... (other methods)
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
   new PortfolioApp();
});
