export class GPUMemoryMonitor {
   private static instance: GPUMemoryMonitor;
   private memoryInfo: Map<string, number> = new Map();

   static getInstance(): GPUMemoryMonitor {
      if (!this.instance) {
         this.instance = new GPUMemoryMonitor();
      }
      return this.instance;
   }

   logBufferCreation(label: string, size: number): void {
      const current = this.memoryInfo.get(label) || 0;
      this.memoryInfo.set(label, current + size);
      console.log(`📈 GPU Buffer created: ${label} (+${size} bytes, total: ${current + size})`);
   }

   logBufferDestruction(label: string, size: number): void {
      const current = this.memoryInfo.get(label) || 0;
      const newTotal = Math.max(0, current - size);
      this.memoryInfo.set(label, newTotal);
      console.log(`📉 GPU Buffer destroyed: ${label} (-${size} bytes, remaining: ${newTotal})`);
   }

   getTotalMemoryUsage(): number {
      return Array.from(this.memoryInfo.values()).reduce((sum, size) => sum + size, 0);
   }

   logMemoryReport(): void {
      console.log('🔍 GPU Memory Report:');
      let total = 0;
      this.memoryInfo.forEach((size, label) => {
         if (size > 0) {
            console.log(`  ${label}: ${(size / 1024 / 1024).toFixed(2)} MB`);
            total += size;
         }
      });
      console.log(`  Total: ${(total / 1024 / 1024).toFixed(2)} MB`);
   }

   clear(): void {
      this.memoryInfo.clear();
   }
}
