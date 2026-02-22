package sysinfo

import (
	"log"
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

// GetTotalMemory returns total system RAM in bytes
func GetTotalMemory() int64 {
	v, err := mem.VirtualMemory()
	if err != nil {
		log.Printf("sysinfo: failed to get memory info: %v", err)
		return 0
	}
	return int64(v.Total)
}

// GetAvailableMemory returns available (free + cached) RAM in bytes
func GetAvailableMemory() int64 {
	v, err := mem.VirtualMemory()
	if err != nil {
		log.Printf("sysinfo: failed to get memory info: %v", err)
		return 0
	}
	return int64(v.Available)
}

// GetTotalDisk returns total disk space at the given path in bytes
func GetTotalDisk(path string) int64 {
	if path == "" {
		path = defaultDiskPath()
	}
	usage, err := disk.Usage(path)
	if err != nil {
		log.Printf("sysinfo: failed to get disk info for %s: %v", path, err)
		return 0
	}
	return int64(usage.Total)
}

// GetAvailableDisk returns available disk space at the given path in bytes
func GetAvailableDisk(path string) int64 {
	if path == "" {
		path = defaultDiskPath()
	}
	usage, err := disk.Usage(path)
	if err != nil {
		log.Printf("sysinfo: failed to get disk info for %s: %v", path, err)
		return 0
	}
	return int64(usage.Free)
}

// GetCPUUsage returns overall CPU usage as a percentage (0-100)
func GetCPUUsage() float64 {
	percents, err := cpu.Percent(500*time.Millisecond, false)
	if err != nil || len(percents) == 0 {
		log.Printf("sysinfo: failed to get CPU usage: %v", err)
		return 0
	}
	return percents[0]
}

// GetUptime returns system uptime in seconds
func GetUptime() int64 {
	uptime, err := host.Uptime()
	if err != nil {
		log.Printf("sysinfo: failed to get uptime: %v", err)
		return 0
	}
	return int64(uptime)
}

// GetSystemInfo returns a snapshot of all system resources
type SystemInfo struct {
	TotalMemoryBytes     int64   `json:"total_memory_bytes"`
	AvailableMemoryBytes int64   `json:"available_memory_bytes"`
	TotalDiskBytes       int64   `json:"total_disk_bytes"`
	AvailableDiskBytes   int64   `json:"available_disk_bytes"`
	CPUUsagePercent      float64 `json:"cpu_usage_percent"`
	UptimeSeconds        int64   `json:"uptime_seconds"`
	OS                   string  `json:"os"`
	Arch                 string  `json:"arch"`
}

// GetAll returns a full system resource snapshot
func GetAll(dataDir string) SystemInfo {
	return SystemInfo{
		TotalMemoryBytes:     GetTotalMemory(),
		AvailableMemoryBytes: GetAvailableMemory(),
		TotalDiskBytes:       GetTotalDisk(dataDir),
		AvailableDiskBytes:   GetAvailableDisk(dataDir),
		CPUUsagePercent:      GetCPUUsage(),
		UptimeSeconds:        GetUptime(),
		OS:                   runtime.GOOS,
		Arch:                 runtime.GOARCH,
	}
}

// defaultDiskPath returns the default path to check disk usage
func defaultDiskPath() string {
	if runtime.GOOS == "windows" {
		return "C:\\"
	}
	return "/"
}

// DefaultDataDir returns the platform-appropriate data directory
func DefaultDataDir() string {
	if runtime.GOOS == "windows" {
		return "C:\\ProgramData\\IronHost"
	}
	return "/var/lib/ironhost"
}

// DefaultCertDir returns the platform-appropriate certificate directory
func DefaultCertDir() string {
	if runtime.GOOS == "windows" {
		return "C:\\ProgramData\\IronHost\\certs"
	}
	return "/etc/ironhost/certs"
}
