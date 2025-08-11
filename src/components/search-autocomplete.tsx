'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Search,
  TrendingUp,
  Star,
  Clock,
  Tag,
  Zap,
  ArrowRight,
  X
} from 'lucide-react'

interface Suggestion {
  text: string
  type: 'suggestion' | 'completion' | 'category' | 'popular' | 'trending'
  score: number
}

interface SearchAutocompleteProps {
  value: string
  onValueChange: (value: string) => void
  onSearch: (query: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function SearchAutocomplete({
  value,
  onValueChange,
  onSearch,
  placeholder = 'Search templates and collections...',
  disabled = false,
  className = ''
}: SearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [popular, setPopular] = useState<string[]>([])
  const [trending, setTrending] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('searchHistory')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5))
      } catch (error) {
        console.error('Error loading search history:', error)
      }
    }
  }, [])

  // Save search to history
  const saveToHistory = (query: string) => {
    if (!query.trim()) return
    
    const newHistory = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5)
    setRecentSearches(newHistory)
    localStorage.setItem('searchHistory', JSON.stringify(newHistory))
  }

  // Debounced suggestions fetch
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      // Fetch popular and trending when no query
      try {
        setLoading(true)
        const response = await fetch('/api/search/suggestions?includePopular=true&includeTrending=true')
        const data = await response.json()
        
        if (data.success) {
          setSuggestions([])
          setPopular(data.data.popular || [])
          setTrending(data.data.trending || [])
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error)
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&limit=8`)
      const data = await response.json()
      
      if (data.success) {
        setSuggestions(data.data.suggestions || [])
        setPopular([])
        setTrending([])
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error)
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle input change with debouncing
  const handleInputChange = (newValue: string) => {
    onValueChange(newValue)
    setSelectedIndex(-1)
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Set new debounce
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue)
    }, 300)
  }

  // Handle search execution
  const handleSearch = (query: string = value) => {
    if (!query.trim()) return
    
    saveToHistory(query.trim())
    onSearch(query.trim())
    setIsOpen(false)
    inputRef.current?.blur()
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    onValueChange(suggestion)
    handleSearch(suggestion)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    const allItems = [
      ...recentSearches.map(s => ({ text: s, type: 'recent' as const })),
      ...suggestions,
      ...popular.map(p => ({ text: p, type: 'popular' as const })),
      ...trending.map(t => ({ text: t, type: 'trending' as const }))
    ]

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && allItems[selectedIndex]) {
          handleSuggestionSelect(allItems[selectedIndex].text)
        } else {
          handleSearch()
        }
        break
      case 'Escape':
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  // Handle focus and blur
  const handleFocus = () => {
    setIsOpen(true)
    if (!value.trim()) {
      fetchSuggestions('')
    }
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Delay closing to allow for clicks on suggestions
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setIsOpen(false)
      }
    }, 150)
  }

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([])
    localStorage.removeItem('searchHistory')
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'category':
        return <Tag className="w-4 h-4" />
      case 'popular':
        return <Star className="w-4 h-4" />
      case 'trending':
        return <TrendingUp className="w-4 h-4" />
      case 'recent':
        return <Clock className="w-4 h-4" />
      default:
        return <Search className="w-4 h-4" />
    }
  }

  const getSuggestionBadge = (type: string) => {
    switch (type) {
      case 'category':
        return <Badge variant="outline" className="text-xs">Category</Badge>
      case 'popular':
        return <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">Popular</Badge>
      case 'trending':
        return <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">Trending</Badge>
      default:
        return null
    }
  }

  return (
    <div className={`relative ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={disabled}
              className="pl-10 pr-10"
            />
            {value && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onValueChange('')
                  inputRef.current?.focus()
                }}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        
        <PopoverContent 
          ref={suggestionsRef}
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          sideOffset={4}
        >
          <Command>
            <CommandList className="max-h-80">
              {loading && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Zap className="w-4 h-4 animate-pulse mx-auto mb-2" />
                  Searching...
                </div>
              )}
              
              {/* Recent Searches */}
              {!loading && recentSearches.length > 0 && !value.trim() && (
                <CommandGroup heading="Recent Searches">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-xs text-muted-foreground">Recent</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearRecentSearches}
                      className="h-auto p-1 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                  {recentSearches.map((search, index) => (
                    <CommandItem
                      key={`recent-${search}`}
                      onSelect={() => handleSuggestionSelect(search)}
                      className={selectedIndex === index ? 'bg-accent' : ''}
                    >
                      <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span>{search}</span>
                      <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />
                    </CommandItem>
                  ))}
                  <CommandSeparator />
                </CommandGroup>
              )}
              
              {/* Suggestions */}
              {!loading && suggestions.length > 0 && (
                <CommandGroup heading="Suggestions">
                  {suggestions.map((suggestion, index) => {
                    const globalIndex = recentSearches.length + index
                    return (
                      <CommandItem
                        key={`suggestion-${suggestion.text}`}
                        onSelect={() => handleSuggestionSelect(suggestion.text)}
                        className={selectedIndex === globalIndex ? 'bg-accent' : ''}
                      >
                        {getSuggestionIcon(suggestion.type)}
                        <span className="ml-2 flex-1">{suggestion.text}</span>
                        {getSuggestionBadge(suggestion.type)}
                        <ArrowRight className="w-3 h-3 ml-2 text-muted-foreground" />
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}
              
              {/* Popular Searches */}
              {!loading && popular.length > 0 && !value.trim() && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Popular">
                    {popular.map((search, index) => {
                      const globalIndex = recentSearches.length + suggestions.length + index
                      return (
                        <CommandItem
                          key={`popular-${search}`}
                          onSelect={() => handleSuggestionSelect(search)}
                          className={selectedIndex === globalIndex ? 'bg-accent' : ''}
                        >
                          <Star className="w-4 h-4 mr-2 text-yellow-500" />
                          <span className="flex-1">{search}</span>
                          <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                            Popular
                          </Badge>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </>
              )}
              
              {/* Trending Searches */}
              {!loading && trending.length > 0 && !value.trim() && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Trending">
                    {trending.map((search, index) => {
                      const globalIndex = recentSearches.length + suggestions.length + popular.length + index
                      return (
                        <CommandItem
                          key={`trending-${search}`}
                          onSelect={() => handleSuggestionSelect(search)}
                          className={selectedIndex === globalIndex ? 'bg-accent' : ''}
                        >
                          <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                          <span className="flex-1">{search}</span>
                          <Badge variant="secondary" className="text-xs bg-green-50 text-green-700">
                            Trending
                          </Badge>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </>
              )}
              
              {/* No Results */}
              {!loading && suggestions.length === 0 && popular.length === 0 && trending.length === 0 && recentSearches.length === 0 && (
                <CommandEmpty>
                  <div className="text-center py-4">
                    <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No suggestions available</p>
                    {value.trim() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSearch()}
                        className="mt-2"
                      >
                        Search for "{value.trim()}"
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
              )}
              
              {/* Search Action */}
              {value.trim() && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => handleSearch()}
                      className="font-medium text-primary"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Search for "{value.trim()}"
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}