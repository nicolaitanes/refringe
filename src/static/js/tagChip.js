// TagChip.js - Organizer interface for tag management with chips
import { ref, onMounted, computed } from 'vue';
import { useTags } from 'useTags';

export default {
    name: 'TagChip',
    props: {
        entityType: {
            type: String,
            required: true,
            validator: value => ['proposal', 'show', 'user', 'venue'].includes(value)
        },
        entityid: {
            type: [String, Number],
            required: true
        },
        className: {
            type: String,
            default: ''
        },
        showAddButton: {
            type: Boolean,
            default: true
        },
        readonly: {
            type: Boolean,
            default: false
        }
    },
    watch: {
        entityid: function() { this.loadEntityTags(); }
    },
    setup(props) {
        const tagging = useTags();
        const {
            tags,
            proposalTags,
            showTags,
            userTags,
            venueTags,
            loading,
            error,
            createTag,
            loadTags,
            searchTags,
            linkTagToProposal,
            linkTagToShow,
            linkTagToUser,
            linkTagToVenue,
            unlinkTagFromProposal,
            unlinkTagFromShow,
            unlinkTagToUser,
            unlinkTagToVenue,
            getTagsForProposals,
            getTagsForShows,
            getTagsForUsers,
            getTagsForVenues,
            formatTagDisplay
        } = tagging;

        // Component state
        const entityTags = ref([]);
        const showSelector = ref(false);
        const searchTerm = ref('');
        const searchResults = ref([]);
        const searchLoading = ref(false);
        const actionLoading = ref(false);

        // Computed properties
        const availableTagsForAdd = computed(() => {
            // Tags that aren't already attached to this entity
            const currentTagids = entityTags.value.map(tag => tag.id);
            return searchResults.value.filter(tag => !currentTagids.includes(tag.id));
        });

        const hasEntityTags = computed(() => entityTags.value.length > 0);

        // Load entity tags on mount
        async function loadEntityTags(force=false) {
            try {
                const tagsRef = tagging[props.entityType + 'Tags'];
                const loadFunction = tagging['getTagsFor' + props.entityType[0].toUpperCase() + props.entityType.slice(1) + 's'];
                const idField = props.entityType + 'id';
                if (force || !tagsRef.value.length) await loadFunction();
                entityTags.value = tagsRef.value.filter(t => t[idField] === props.entityid);
            } catch (err) {
                console.error(`Error loading ${props.entityType} tags:`, err);
            }
        }

        // Handle tag search for autocomplete
        async function handleTagSearch() {
            if (searchTerm.value.trim().length < 2) {
                searchResults.value = [];
                return;
            }

            searchLoading.value = true;
            try {
                searchResults.value = await searchTags(searchTerm.value.trim(), 20);
            } catch (err) {
                console.error('Error searching tags:', err);
                searchResults.value = [];
            } finally {
                searchLoading.value = false;
            }
        }

        // Add a tag to the entity
        async function addTag(tag) {
            if (props.readonly) return;
            
            actionLoading.value = true;
            try {
                const linkFunction = tagging['linkTagTo' + props.entityType[0].toUpperCase() + props.entityType.slice(1)];
                const success = await linkFunction(tag.id, props.entityid);
                
                if (success) {
                    entityTags.value.push(tag);
                    searchTerm.value = '';
                    searchResults.value = [];
                    showSelector.value = false;
                    await loadEntityTags(true);
                }
            } catch (err) {
                console.error(`Error adding tag to ${props.entityType}:`, err);
            } finally {
                actionLoading.value = false;
            }
        }

        async function createAndAddTag(tag) {
            if (props.readonly) return;
            
            actionLoading.value = true;
            try {
                const tagObject = await createTag(tag);
                this.addTag(tagObject);
                const tagsRef = tagging[props.entityType + 'Tags'];
                tagsRef.value = [...tagsRef.value, tagObject];
            } catch (err) {
                console.error(`Error adding new tag ${tag} to ${props.entityType}:`, err);
            } finally {
                actionLoading.value = false;
            }
        }

        // Remove a tag from the entity
        async function removeTag(tag) {
            if (props.readonly) return;
            
            actionLoading.value = true;
            try {
                const unlinkFunction = tagging['unlinkTagFrom' + props.entityType[0].toUpperCase() + props.entityType.slice(1)];
                const success = await unlinkFunction(tag.id, props.entityid);
                
                if (success) {
                    const index = entityTags.value.findIndex(t => t.id === tag.id);
                    if (index !== -1) {
                        entityTags.value.splice(index, 1);
                    }
                    await loadEntityTags(true);
                }
            } catch (err) {
                console.error(`Error removing tag from ${props.entityType}:`, err);
            } finally {
                actionLoading.value = false;
            }
        }

        // Initialize component
        onMounted(async () => {
            if (!tags.value.length) await loadTags();
            await loadEntityTags();
        });

        return {
            // State
            entityTags,
            showSelector,
            searchTerm,
            searchResults,
            searchLoading,
            actionLoading,
            
            // Computed
            availableTagsForAdd,
            hasEntityTags,
            
            // Methods
            handleTagSearch,
            addTag,
            createAndAddTag,
            loadEntityTags,
            removeTag,
            formatTagDisplay
        };
    },
    template: `
        <div class="tag-chip-container" :class="className">
            <!-- Existing tags -->
            <span v-if="hasEntityTags" class="tag-chips">
                <span 
                    v-for="tag in entityTags" 
                    :key="tag.id" 
                    class="tag-chip"
                    :title="tag.description || tag.name"
                >
                    {{ formatTagDisplay(tag) }}
                    <button 
                        v-if="!readonly"
                        @click="removeTag(tag)" 
                        class="tag-chip-remove"
                        :disabled="actionLoading"
                        title="Remove tag"
                    >
                        ×
                    </button>
                </span>
            </span>

            <!-- Add tag interface -->
            <span v-if="showAddButton && !readonly" class="tag-add-section">
                <button 
                    v-if="!showSelector"
                    @click="showSelector = true" 
                    class="tag-add-button"
                    :disabled="actionLoading"
                >
                    + Add Tag
                </button>

                <!-- Tag selector overlay -->
                <div v-if="showSelector" class="tag-selector-overlay">
                    <div class="tag-selector">
                        <input 
                            v-model="searchTerm"
                            @input="handleTagSearch"
                            type="text"
                            placeholder="Search tags..."
                            class="tag-search-input"
                            autofocus
                        >
                        
                        <div v-if="searchLoading" class="tag-search-loading">
                            Searching...
                        </div>
                        
                        <div v-if="availableTagsForAdd.length > 0" class="tag-search-results">
                            <button 
                                v-for="tag in availableTagsForAdd" 
                                :key="tag.id"
                                @click="addTag(tag)"
                                class="tag-search-result"
                                :disabled="actionLoading"
                            >
                                {{ formatTagDisplay(tag) }}
                                <span v-if="tag.description" class="tag-description">
                                    - {{ tag.description }}
                                </span>
                            </button>
                        </div>
                        
                        <button
                            v-else-if="searchTerm.length >= 2 && !searchLoading"
                            @click="createAndAddTag({ name: searchTerm })"
                            :disabled="actionLoading"
                        >
                            +
                        </button>
                        
                        <div class="tag-selector-actions">
                            <button @click="showSelector = false" class="tag-cancel-button">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </span>
        </div>
    `,
    styles: `
        <style>
        .tag-chip-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .tag-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .tag-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #e3f2fd;
            border: 1px solid #2196f3;
            border-radius: 16px;
            padding: 4px 8px;
            font-size: 12px;
            color: #1976d2;
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .tag-chip-remove {
            background: none;
            border: none;
            color: #1976d2;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
            padding: 0;
            margin: 0;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.2s;
        }

        .tag-chip-remove:hover {
            background-color: rgba(25, 118, 210, 0.1);
        }

        .tag-chip-remove:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .tag-add-section {
            position: relative;
        }

        .tag-add-button {
            background: #4caf50;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }

        .tag-add-button:hover {
            background: #45a049;
        }

        .tag-add-button:disabled {
            background: #cccccc;
            cursor: not-allowed;
        }

        .tag-selector-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .tag-selector {
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 400px;
            width: 90%;
            max-height: 500px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .tag-search-input {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }

        .tag-search-input:focus {
            outline: none;
            border-color: #2196f3;
        }

        .tag-search-loading {
            text-align: center;
            color: #666;
            font-style: italic;
        }

        .tag-search-results {
            max-height: 300px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .tag-search-result {
            text-align: left;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .tag-search-result:hover {
            background: #f5f5f5;
        }

        .tag-search-result:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .tag-description {
            color: #666;
            font-size: 12px;
        }

        .tag-selector-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
        }

        .tag-cancel-button {
            background: #f44336;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 12px;
        }

        .tag-cancel-button:hover {
            background: #d32f2f;
        }
        </style>
    `
};
