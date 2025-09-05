export class MouseTracker {
   // private prevPos: Float32Array = new Float32Array([0.0, 0.0]);
   private pos: Float32Array = new Float32Array([0.0, 0.0]);
   private mouseEventCleanup: (() => void)[] = [];
   // private startTime: number = Date.now();
   private scrollValue: number = 2000.0;
   private settings: Float32Array = new Float32Array([30, 10, 10, 0.5]);
   private resolution: Float32Array = new Float32Array(2);
   // private dt: number = 0;

   constructor() {
      console.log("Creating MouseTracker...")
      this.initEvents();
   }

   private initEvents(): void {
      const handleMove = (event: MouseEvent) => {
         // this.dt = Date.now() - this.startTime;
         // this.startTime = Date.now();

         [this.pos[0], this.pos[1]] = [event.clientX, event.clientY];
         // let dp = this.pos.map((n, i) => n - this.prevPos[i]);
         // let v = dp.map((n) => n / this.dt);
         // this.velocity = Math.sqrt(v.reduce((vel, n) => vel + n * n));
      }
      const handleScroll = (event: WheelEvent) => {
         this.scrollValue += event.deltaX + event.deltaY + event.deltaZ;
      }

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('wheel', handleScroll);

      this.mouseEventCleanup.push(
         () => document.removeEventListener('mousemove', handleMove),
         () => document.removeEventListener('wheel', handleScroll),
      );
   }

   setResolution(width: number, height: number): void {
      this.resolution[0] = width;
      this.resolution[1] = height;
   }

   getSettings(): Float32Array {
      this.pos.forEach((n, i) => this.settings[i] = n / this.resolution[i] * 40)
      this.settings[2] = clamp(this.scrollValue / 100, 0, 40);
      return this.settings;
   }

   destroy(): void {
      console.log("Destroying MouseTracker...");

      this.mouseEventCleanup.forEach(cleanup => cleanup());
      this.mouseEventCleanup.length = 0;
   }
}

function clamp(x: number, a: number, b: number): number {
   return Math.max(a, Math.min(x, b));
}
